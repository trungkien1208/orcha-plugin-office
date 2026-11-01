import { readTerminal } from "../actions.ts";
import { accountsAffectAgents, defaultAccountRoots, readOfficeAccounts, rememberAccounts, stampAccounts, type AccountRoots } from "../accounts.ts";
import { handoffReady } from "../handoff.ts";
import { mapAccounts, supports } from "../orcha/v24.ts";
import { flushModels } from "../model-queue.ts";
import { flushSwitches } from "../switch.ts";
import { terminalConversation } from "../conversation/terminal.ts";
import { watchTranscript, type TranscriptWatch } from "../conversation/watch.ts";
import { allowedHost, allowedOrigin, bearer, websocketToken } from "./guard.ts";
import { handleApi, type RouteDeps } from "./routes.ts";
import type { OfficeLink } from "../orcha/link.ts";
import type { ActivityLog } from "../state/activity.ts";
import type { AccountInfo, ClientMessage, ConversationItem, OfficeState, ServerMessage } from "@easy-job/shared";
import fs from "node:fs";
import path from "node:path";

type SocketData = { watches: Set<string>; denied?: boolean };
type OfficeSocket = Bun.ServerWebSocket<SocketData>;
type Tail = {
  watch: TranscriptWatch;
  sockets: Set<OfficeSocket>;
  session?: string;
  missingSince?: number;
  retry?: ReturnType<typeof setTimeout>;
  terminal?: ReturnType<typeof setInterval>;
  terminalText?: string;
  reading?: boolean;
};

export type OfficeServer = {
  port: number;
  token: string;
  bridgeId: string;
  /** Open conversation tails. Tests use this to see that the last watcher was released. */
  openTails(): number;
  stop(): void;
};

export function startServer(input: {
  link: OfficeLink;
  activity: ActivityLog;
  distDir: string;
  port?: number;
  open?: boolean;
  token?: string;
  bridgeId?: string;
  extraOrigins?: string[];
  home?: string;
  /** Transcript root. Defaults to the real home directory. Tests pass a temp dir. */
  transcriptHome?: string;
  /** How often to look again for a transcript that is not on disk yet. Defaults to 2s. */
  transcriptRetryMs?: number;
  /** Stop looking after this long while someone is still watching. Defaults to 60s. */
  transcriptGiveUpMs?: number;
  /** How often to re-read the terminal when there is no transcript. Defaults to 2s. */
  terminalPollMs?: number;
  /** Orcha account files. Defaults to the real home. Tests pass a temp folder. */
  accountRoots?: AccountRoots;
  /** How often to re-read accounts and fuel. Defaults to 5s. */
  accountPollMs?: number;
}): OfficeServer {
  const token = input.token ?? Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  const bridgeId = input.bridgeId ?? crypto.randomUUID();
  let version = 0;
  const accountRoots = input.accountRoots ?? defaultAccountRoots();
  const deps: RouteDeps = { link: input.link, activity: input.activity, home: input.home, accountRoots };
  const sockets = new Set<OfficeSocket>();
  const retryMs = input.transcriptRetryMs ?? 2_000;
  const giveUpMs = input.transcriptGiveUpMs ?? 60_000;
  const terminalPollMs = input.terminalPollMs ?? 2_000;
  const tails = new Map<string, Tail>();
  let pending: OfficeState | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const publish = (state: OfficeState) => {
    pending = state;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const state = pending;
      if (!state) return;
      state.capabilities = capabilities();
      stampAccounts(state.agents, knownAccounts);
      version += 1;
      const message = JSON.stringify({ type: "state", version, state: state satisfies OfficeState } satisfies ServerMessage);
      for (const socket of sockets) socket.send(message);
    }, 100);
  };
  const capabilities = () => ({
    accountApi: supports(input.link, "accounts.switch"),
    handoff: supports(input.link, "agent.handoff") || handoffReady(accountRoots.orchaDir),
  });
  let knownAccounts: AccountInfo[] = [];
  let accountsJson = "";
  const pushAccounts = (accounts: AccountInfo[]) => {
    const json = JSON.stringify(accounts);
    if (json === accountsJson) return;
    const restamp = accountsAffectAgents(input.link.state().agents, accounts);
    accountsJson = json;
    knownAccounts = accounts;
    const message = JSON.stringify({ type: "accounts", accounts } satisfies ServerMessage);
    for (const socket of sockets) socket.send(message);
    if (restamp) input.link.reemit();
  };
  let readingAccounts = false;
  const refreshAccounts = () => {
    if (readingAccounts) return;
    readingAccounts = true;
    void readOfficeAccounts(input.link, accountRoots)
      .then(pushAccounts)
      .catch(() => undefined)
      .finally(() => {
        readingAccounts = false;
      });
  };
  // Protocol 24 pushes `accounts.changed`; the poll then only fills the first list.
  const stopAccounts = input.link.onAccounts?.((raw) => {
    const accounts = mapAccounts(raw);
    rememberAccounts(accountRoots, accounts);
    pushAccounts(accounts);
  });
  const pushed = () => !!input.link.capabilities?.()?.events?.includes("accounts.changed") && accountsJson !== "";
  const accountTimer = setInterval(() => {
    if (!pushed()) refreshAccounts();
  }, input.accountPollMs ?? 5_000);
  accountTimer.unref?.();
  refreshAccounts();
  const stopLinkListener = listen(input.link, input.activity, publish, (entry) => {
    const message = JSON.stringify({ type: "activity", entry } satisfies ServerMessage);
    for (const socket of sockets) socket.send(message);
  }, (state) => {
    state.capabilities = capabilities();
    stampAccounts(state.agents, knownAccounts);
    syncSessions(state);
    void flushModels(input.link, state.agents, input.activity);
    void flushSwitches({ link: input.link, agents: state.agents, roots: accountRoots, activity: input.activity });
  });

  let server: ReturnType<typeof Bun.serve> | null = null;
  let port = input.port ?? 4317;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      server = Bun.serve<SocketData>({
        hostname: "127.0.0.1",
        port,
        fetch: (req, bun) => fetch(req, bun),
        websocket: {
          open(socket) {
            if (socket.data.denied) {
              socket.close(4401, "bad_token");
              return;
            }
            sockets.add(socket);
            socket.send(JSON.stringify({ type: "hello", bridgeId, serverTime: Date.now(), version } satisfies ServerMessage));
            socket.send(JSON.stringify({ type: "state", version, state: input.link.state() } satisfies ServerMessage));
          },
          message(socket, raw) {
            onMessage(socket, raw);
          },
          close(socket) {
            sockets.delete(socket);
            for (const paneId of [...tails.keys()]) {
              const tail = tails.get(paneId);
              if (!tail?.sockets.delete(socket)) continue;
              releaseTail(paneId);
            }
          },
        },
      });
      break;
    } catch (error) {
      if (attempt === 19) throw error;
      port += 1;
    }
  }
  if (!server) throw new Error("Could not bind");
  const bound = server.port ?? port;
  const origins = [`http://127.0.0.1:${bound}`, `http://localhost:${bound}`, ...(input.extraOrigins ?? [])];

  function fetch(req: Request, bun: Bun.Server<SocketData>): Response | Promise<Response> {
    const host = req.headers.get("host");
    const origin = req.headers.get("origin");
    if (!allowedHost(host, bound) || !allowedOrigin(origin, origins)) {
      return new Response("Forbidden", { status: 403 });
    }
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/api/health") return healthResponse(input.link.state());
    if (url.pathname === "/ws") {
      const selected = websocketToken(req.headers.get("sec-websocket-protocol"), token);
      const headers = selected ? { "Sec-WebSocket-Protocol": selected } : undefined;
      if (!bun.upgrade(req, { data: { watches: new Set(), denied: !selected }, headers })) return badToken();
      return undefined as unknown as Response;
    }
    if (url.pathname.startsWith("/api/")) {
      if (!bearer(req.headers.get("authorization"), token)) return badToken();
      return handleApi(req, deps);
    }
    return staticFile(url.pathname);
  }

  function onMessage(socket: OfficeSocket, raw: string | Buffer) {
    let message: ClientMessage;
    try {
      message = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Bad message" } satisfies ServerMessage));
      return;
    }
    if (message.type === "unwatch-conversation") {
      socket.data.watches.delete(message.paneId);
      tails.get(message.paneId)?.sockets.delete(socket);
      releaseTail(message.paneId);
      return;
    }
    if (message.type !== "watch-conversation") return;
    socket.data.watches.add(message.paneId);
    const agent = input.link.state().agents.find((item) => item.paneId === message.paneId);
    const session = agent?.session?.value;
    const existing = tails.get(message.paneId);
    if (existing && existing.session === session) {
      existing.sockets.add(socket);
      socket.send(conversationPayload(message.paneId, existing.watch.items, false));
      return;
    }
    if (!agent || !session) {
      const socketsForPane = existing?.sockets ?? new Set<OfficeSocket>();
      socketsForPane.add(socket);
      followSession(message.paneId, socketsForPane, session, Boolean(existing));
      return;
    }
    const socketsForPane = existing?.sockets ?? new Set<OfficeSocket>();
    socketsForPane.add(socket);
    followSession(message.paneId, socketsForPane, session, false);
  }

  function conversationPayload(paneId: string, items: ConversationItem[], reset: boolean): string {
    return JSON.stringify({ type: "conversation", paneId, items, reset, terminal: tails.get(paneId)?.watch.hit.kind === "missing" } satisfies ServerMessage);
  }

  function sendConversation(paneId: string, items: ConversationItem[], reset: boolean) {
    const payload = conversationPayload(paneId, items, reset);
    for (const client of tails.get(paneId)?.sockets ?? []) client.send(payload);
  }

  /** Close the watcher and drop the tail once nobody is watching. */
  function releaseTail(paneId: string) {
    const tail = tails.get(paneId);
    if (!tail || tail.sockets.size > 0) return;
    if (tail.retry) clearTimeout(tail.retry);
    stopTerminal(tail);
    tail.watch.close();
    tails.delete(paneId);
  }

  function followSession(paneId: string, socketsForPane: Set<OfficeSocket>, session: string | undefined, reset: boolean, missingSince?: number) {
    const previous = tails.get(paneId);
    if (previous?.retry) clearTimeout(previous.retry);
    previous?.watch.close();
    const agent = input.link.state().agents.find((item) => item.paneId === paneId);
    const watch = watchTranscript(
      { kind: agent?.kind, cwd: agent?.cwd, session, home: input.transcriptHome, transcriptPath: agent?.session?.transcript_path },
      (items) => sendConversation(paneId, items, false),
    );
    const tail = tails.get(paneId) ?? { watch, sockets: socketsForPane, session, missingSince, retry: undefined as ReturnType<typeof setTimeout> | undefined };
    tail.watch = watch;
    tail.sockets = socketsForPane;
    tail.session = session;
    tail.missingSince = missingSince;
    tails.set(paneId, tail);
    const found = watch.hit.kind !== "missing";
    if (found || (reset && missingSince == null)) sendConversation(paneId, watch.items, reset);
    if (found) stopTerminal(tail);
    else ensureTerminal(paneId);
    if (found || !session || socketsForPane.size === 0) return;
    const since = missingSince ?? Date.now();
    tail.missingSince = since;
    if (Date.now() - since >= giveUpMs) return;
    tail.retry = setTimeout(() => {
      const current = tails.get(paneId);
      if (!current || current.sockets.size === 0 || current.session !== session) return;
      followSession(paneId, current.sockets, session, true, since);
    }, retryMs);
  }

  function syncSessions(state: OfficeState) {
    for (const [paneId, tail] of [...tails]) {
      const agent = state.agents.find((item) => item.paneId === paneId);
      if (!agent) {
        if (tail.sockets.size > 0) sendConversation(paneId, [], true);
        tail.sockets.clear();
        releaseTail(paneId);
        continue;
      }
      const session = agent.session?.value;
      if (session === tail.session) continue;
      if (tail.sockets.size === 0) {
        releaseTail(paneId);
        continue;
      }
      followSession(paneId, tail.sockets, session, true);
    }
  }

  function stopTerminal(tail: Tail) {
    if (!tail.terminal) return;
    clearInterval(tail.terminal);
    tail.terminal = undefined;
  }

  function ensureTerminal(paneId: string) {
    const tail = tails.get(paneId);
    if (!tail || tail.terminal) return;
    const tick = () => void pollTerminal(paneId);
    tick();
    tail.terminal = setInterval(tick, terminalPollMs);
    tail.terminal.unref?.();
  }

  async function pollTerminal(paneId: string) {
    const tail = tails.get(paneId);
    if (!tail || tail.reading || tail.sockets.size === 0 || tail.watch.hit.kind !== "missing") return;
    tail.reading = true;
    try {
      const text = await readTerminal(input.link, paneId);
      const current = tails.get(paneId);
      if (!current || current.sockets.size === 0 || current.watch.hit.kind !== "missing" || text === current.terminalText) return;
      current.terminalText = text;
      sendConversation(paneId, terminalConversation({ read: { text } }, paneId), true);
    } catch {
      /* Orcha didn't answer; the next poll tries again */
    } finally {
      if (tail) tail.reading = false;
    }
  }

  function staticFile(pathname: string): Response {
    const root = path.resolve(input.distDir);
    const landing = pathname === "/landing" || pathname === "/landing/" || pathname === "/landing.html";
    const requested = landing ? "landing.html" : pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(root, requested);
    const inside = file === root || file.startsWith(`${root}${path.sep}`);
    const exact = inside && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
    if (landing && !exact) return new Response("Landing page is missing from the web build.", { status: 404 });
    const target = exact ?? path.join(root, "index.html");
    if (!fs.existsSync(target)) return new Response("Easy Job web build is missing. Run bun run build:web.", { status: 503 });
    const headers = target.endsWith(".html") ? HTML_SECURITY : undefined;
    return new Response(Bun.file(target), { headers });
  }

  const heartbeat = setInterval(() => {
    const message = JSON.stringify({ type: "ping", at: Date.now() } satisfies ServerMessage);
    for (const socket of sockets) socket.send(message);
  }, 15_000);

  const url = `http://127.0.0.1:${bound}/#t=${token}`;
  process.stdout.write(`${url}\n`);
  if (input.open !== false) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });

  return {
    port: bound,
    token,
    bridgeId,
    openTails: () => tails.size,
    stop() {
      stopLinkListener();
      clearInterval(accountTimer);
      stopAccounts?.();
      clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
      for (const tail of tails.values()) {
        if (tail.retry) clearTimeout(tail.retry);
        stopTerminal(tail);
        tail.watch.close();
      }
      tails.clear();
      server?.stop(true);
    },
  };
}

const HTML_SECURITY = {
  "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function badToken(): Response {
  return Response.json({ error: "bad_token" }, { status: 401 });
}

/** Public liveness. No names, paths, or counts, so the gate can render before it has a token. */
function healthResponse(state: OfficeState): Response {
  const body: { bridge: true; orcha: boolean; protocolWarning?: string } = {
    bridge: true,
    orcha: state.orcha.connected,
  };
  if (state.orcha.protocolWarning) body.protocolWarning = state.orcha.protocolWarning;
  return Response.json(body);
}

function listen(
  link: OfficeLink,
  activity: ActivityLog,
  publish: (state: OfficeState) => void,
  onActivity: (entry: ReturnType<ActivityLog["entries"]>[number]) => void,
  onState: (state: OfficeState) => void,
): () => void {
  let last = link.state();
  let count = activity.entries().length;
  publish(last);
  const timer = setInterval(() => {
    const next = link.state();
    if (next !== last) {
      last = next;
      onState(next);
      publish(next);
    }
    const entries = activity.entries();
    if (entries.length !== count) {
      count = entries.length;
      const entry = entries.at(-1);
      if (entry) onActivity(entry);
    }
  }, 50);
  return () => clearInterval(timer);
}
