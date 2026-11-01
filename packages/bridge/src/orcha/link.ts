import {
  emptyOffice,
  fallbackCatalog,
  layoutToSaved,
  LIFECYCLE_SUBSCRIPTIONS,
  type AgentInfo,
  type OfficeState,
  type OrchaLine,
  type SessionSnapshot,
  type SkinCatalog,
} from "@easy-job/shared";
import type { ActivityLog } from "../state/activity.ts";
import { doneToday } from "../state/kpi.ts";
import { rememberWaiting, reconcile, statusLabel } from "../state/reconcile.ts";
import { readCatalog, setCatalog, watchCatalog } from "../state/catalog.ts";
import type { LocalStore } from "../state/local.ts";
import { createClient, type OrchaClient } from "./client.ts";
import type { Conn } from "./transport.ts";
import { hideOwn } from "../state/hide.ts";
import { applyChanges, type SessionChange } from "./delta.ts";
import { openMux, type Mux } from "./mux.ts";

export type Capabilities = { protocol?: number; methods?: string[]; events?: string[]; features?: string[] };
type SessionEvent = { version: number; epoch: string; changes?: SessionChange[] };
type SyncResult = { type?: string; snapshot?: SessionSnapshot; session_version?: number; session_epoch?: string; changes?: SessionChange[] };

/** Protocol 23's sync API, detected from `server.capabilities` rather than the protocol number. */
export function syncSupported(caps: Capabilities | null): boolean {
  const features = new Set(caps?.features ?? []);
  return (
    !!caps?.methods?.includes("server.multiplex") &&
    !!caps.events?.includes("session.changed") &&
    features.has("events.subscribe.agent_status_all_panes") &&
    features.has("session.snapshot.since")
  );
}

export type LinkOptions = {
  connect: () => Promise<Conn>;
  /** Path shown in office state. A function is read after every connect so a late Orcha socket replaces the fallback. */
  socketPath: string | (() => string);
  local: LocalStore;
  activity: ActivityLog;
  debounceMs?: number;
  /** First retry delay. Defaults to 500. Tests pass 0. */
  backoffStartMs?: number;
  /** Quiet-socket snapshot interval. Defaults to 30s. */
  watchdogMs?: number;
  now?: () => number;
  /** `packages/web/public/office/manifest.json`. Reloaded when the file changes. */
  manifestPath?: string;
  /** Our own bridge pane when running as the Orcha plugin pane; hidden from the Floor. */
  hidePaneId?: string;
  onState?: (state: OfficeState) => void;
  onStatus?: (text: string) => void;
  onWaiting?: () => void;
};

export type OfficeLink = {
  stop(): void;
  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
  state(): OfficeState;
  /** Re-run the reconciler after a local Seen mark or Skin change. */
  reemit(): void;
  updateLocal(mutate: (draft: import("@easy-job/shared").LocalState) => void): void;
  /** Close the live Orcha sockets so the link reconnects. Tests use this for a dead connection. */
  dropSocket(): void;
  /** What the connected Orcha offers (`server.capabilities`), or null for an Orcha without it. */
  capabilities?(): Capabilities | null;
  /** Raw `accounts.changed` payloads (protocol 24). Returns the unsubscribe function. */
  onAccounts?(listener: (accounts: unknown[]) => void): () => void;
};

type SnapshotResult = { type?: string; snapshot?: SessionSnapshot };

export function startLink(opts: LinkOptions): OfficeLink {
  const debounceMs = opts.debounceMs ?? 150;
  const backoffStart = opts.backoffStartMs ?? 500;
  const now = () => opts.now?.() ?? Date.now();
  const client: OrchaClient = createClient(opts.connect);
  const socketPath = () => (typeof opts.socketPath === "function" ? opts.socketPath() : opts.socketPath);
  let activePath = socketPath();
  let current = emptyOffice(activePath, now());
  let cache: SessionSnapshot | null = null;
  let stopped = false;
  let waitingAnnounced = false;
  let ready = false;
  let again = false;
  let refreshing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastBeat = now();
  const watchdogMs = opts.watchdogMs ?? 30_000;
  function touch() {
    lastBeat = now();
  }
  let sleepWake: (() => void) | null = null;
  let lifeConn: Conn | null = null;
  let lifeGen = 0;
  let statusConn: Conn | null = null;
  let statusGen = 0;
  let statusIds = "";
  let endSession: ((error?: Error) => void) | null = null;
  // Protocol 23: one multiplexed connection carries requests, status and session deltas.
  let mux: Mux | null = null;
  const accountListeners = new Set<(accounts: unknown[]) => void>();
  let caps: Capabilities | null = null;
  let syncCatchUp: (() => void) | null = null;
  // Kept across reconnects so a new connection asks only for what changed while it was down.
  let syncVersion = 0;
  let syncEpoch = "";
  // Status events can arrive before a session_changed record that was computed earlier; trust them for a moment.
  const liveStatus = new Map<string, { status: string; at: number }>();
  const LIVE_STATUS_MS = 3000;
  const baseline = new Map<string, string>();
  let haveBaseline = false;
  let catalog: SkinCatalog = opts.manifestPath ? readCatalog(opts.manifestPath) : fallbackCatalog();
  setCatalog(catalog);
  const stopCatalog = opts.manifestPath
    ? watchCatalog(opts.manifestPath, (next) => {
        catalog = next;
        setCatalog(next);
        if (cache) emit();
      })
    : () => undefined;

  function closeStatus() {
    statusGen += 1;
    statusIds = "";
    const previous = statusConn;
    statusConn = null;
    previous?.close();
  }

  function closeAll() {
    const previousMux = mux;
    mux = null;
    syncCatchUp = null;
    previousMux?.close();
    lifeGen += 1;
    lifeConn?.close();
    lifeConn = null;
    closeStatus();
    ready = false;
  }

  function fail(error: Error) {
    if (stopped) return;
    endSession?.(error);
  }

  function emit() {
    if (!cache) return;
    const local = opts.local.get();
    let state = reconcile(hideOwn(cache, opts.hidePaneId), local, now(), activePath, catalog);
    const remembered = rememberWaiting(local, state);
    const waitingChanged = JSON.stringify(remembered.waitingSince) !== JSON.stringify(local.waitingSince);
    if (waitingChanged) {
      opts.local.update((draft) => {
        draft.waitingSince = remembered.waitingSince;
      });
      state = reconcile(hideOwn(cache, opts.hidePaneId), opts.local.get(), now(), activePath, catalog);
    }
    const savedFloor = layoutToSaved(
      state.floor,
      state.agents.map((agent) => ({ agentKey: agent.agentKey, workspaceId: agent.workspaceId, paneId: agent.paneId })),
    );
    if (JSON.stringify(savedFloor) !== JSON.stringify(opts.local.get().floor)) {
      opts.local.update((draft) => {
        draft.floor = savedFloor;
      });
    }
    state = { ...state, kpi: { doneToday: doneToday(opts.activity.entries(), state.projects, now()) } };
    noteTransitions(state);
    current = state;
    waitingAnnounced = false;
    opts.onState?.(state);
  }

  function noteTransitions(state: OfficeState) {
    if (!haveBaseline) {
      haveBaseline = true;
      for (const agent of state.agents) baseline.set(agent.paneId, agent.status);
      return;
    }
    const live = new Set<string>();
    for (const agent of state.agents) {
      live.add(agent.paneId);
      const previous = baseline.get(agent.paneId);
      baseline.set(agent.paneId, agent.status);
      if (previous && previous !== agent.status) {
        const project = state.projects.find((item) => item.workspaceId === agent.workspaceId);
        const text = `${project?.label ?? agent.workspaceId} · ${agent.name} → ${statusLabel(agent.status)}`;
        opts.activity.append({
          kind: "status",
          text,
          paneId: agent.paneId,
          agentKey: agent.agentKey,
          workspaceId: agent.workspaceId,
        });
        opts.onStatus?.(text);
      }
    }
    for (const paneId of baseline.keys()) {
      if (!live.has(paneId)) baseline.delete(paneId);
    }
  }

  function patchModel(message: OrchaLine) {
    const data = message.data as { pane_id?: string; model?: string | null } | undefined;
    const agent = cache?.agents.find((item) => item.pane_id === data?.pane_id);
    if (agent) agent.model = data?.model ?? null;
  }

  function patchStatus(message: OrchaLine) {
    const paneId = message.data?.pane_id;
    const status = message.data?.agent_status;
    if (!cache || !paneId || !status) return;
    if (mux) liveStatus.set(paneId, { status, at: now() });
    const agent = cache.agents.find((item) => item.pane_id === paneId);
    if (agent) agent.agent_status = status;
    const pane = cache.panes.find((item) => item.pane_id === paneId);
    if (pane) pane.agent_status = status;
  }

  function schedule() {
    if (!ready) {
      again = true;
      return;
    }
    if (refreshing) {
      again = true;
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void refresh().catch((error: unknown) => {
        fail(error instanceof Error ? error : new Error("refresh failed"));
      });
    }, debounceMs);
  }

  async function takeSnapshot(): Promise<SessionSnapshot> {
    const result = (await client.request("session.snapshot", {})) as SnapshotResult;
    if (!result?.snapshot?.workspaces || !result.snapshot.panes || !result.snapshot.agents) {
      throw new Error("session.snapshot had no snapshot");
    }
    return result.snapshot;
  }

  async function ensureStatus(snapshot: SessionSnapshot) {
    const ids = snapshot.panes.map((pane) => pane.pane_id).sort();
    const key = ids.join("\n");
    if (ids.length === 0) {
      closeStatus();
      return;
    }
    if (key === statusIds && statusConn) return;
    const conn = await openConn();
    const id = `status-${statusGen + 1}`;
    conn.send({
      id,
      method: "events.subscribe",
      params: {
        subscriptions: ids.map((paneId) => ({ type: "pane.agent_status_changed", pane_id: paneId })),
      },
    });
    const ack = (await conn.next()) as OrchaLine | null;
    if (stopped) {
      conn.close();
      return;
    }
    if (!ack || ack.error || ack.result?.type !== "subscription_started") {
      conn.close();
      throw new Error(ack?.error?.code ?? "status_rejected");
    }
    const gen = ++statusGen;
    const previous = statusConn;
    statusConn = conn;
    statusIds = key;
    previous?.close();
    void readStatus(conn, gen);
  }

  async function openStatus(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
    let currentSnap = snapshot;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await ensureStatus(currentSnap);
        return currentSnap;
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code !== "pane_not_found" && code !== "status_rejected") throw error;
        currentSnap = await takeSnapshot();
        cache = currentSnap;
        emit();
      }
    }
    throw new Error("pane_not_found");
  }

  async function readStatus(conn: Conn, gen: number) {
    while (!stopped && gen === statusGen) {
      const message = (await conn.next()) as OrchaLine | null;
      if (gen !== statusGen || stopped) return;
      if (message == null || message.error?.code === "events_lost") {
        fail(new Error(message?.error?.code ?? "status subscription closed"));
        return;
      }
      if (message.event === "pane.agent_status_changed") {
        patchStatus(message);
        emit();
        touch();
        continue;
      }
      if (message.event || message.error) {
        touch();
        schedule();
      }
    }
  }

  async function readLife(conn: Conn, gen: number) {
    while (!stopped && gen === lifeGen) {
      const message = (await conn.next()) as OrchaLine | null;
      if (gen !== lifeGen || stopped) return;
      if (message == null || message.error?.code === "events_lost") {
        fail(new Error(message?.error?.code ?? "lifecycle subscription closed"));
        return;
      }
      if (message.event) {
        touch();
        schedule();
      }
    }
  }

  async function refresh() {
    if (refreshing) {
      again = true;
      return;
    }
    refreshing = true;
    try {
      for (let pass = 0; pass < 20 && !stopped; pass += 1) {
        again = false;
        const snapshot = await takeSnapshot();
        cache = snapshot;
        emit();
        await openStatus(snapshot);
        if (!again) break;
      }
      if (again) schedule();
      touch();
    } finally {
      refreshing = false;
    }
  }

  /** A gate that holds the session open until the link stops (resolve) or the connection fails (reject). */
  function openGate(): { gate: Promise<void>; failed: () => Error | null } {
    let rejectGate: (error: Error) => void = () => {};
    let resolveGate: () => void = () => {};
    const gate = new Promise<void>((resolve, reject) => {
      resolveGate = resolve;
      rejectGate = reject;
    });
    void gate.catch(() => {});
    let gateError: Error | null = null;
    endSession = (error) => {
      if (!error) {
        resolveGate();
        return;
      }
      if (gateError) return;
      gateError = error;
      ready = false;
      closeAll();
      rejectGate(error);
    };
    return { gate, failed: () => gateError };
  }

  async function session() {
    caps = (await client.request("server.capabilities", {}, 2000).catch(() => null)) as Capabilities | null;
    if (syncSupported(caps)) return syncSession();
    const { gate, failed } = openGate();
    again = false;
    ready = false;
    const life = await openConn();
    const gen = ++lifeGen;
    lifeConn = life;
    life.send({
      id: `life-${gen}`,
      method: "events.subscribe",
      params: { subscriptions: LIFECYCLE_SUBSCRIPTIONS.map((type) => ({ type })) },
    });
    const ack = (await life.next()) as OrchaLine | null;
    if (!ack || ack.error || ack.result?.type !== "subscription_started") {
      life.close();
      throw new Error(ack?.error?.message ?? "lifecycle subscription rejected");
    }
    void readLife(life, gen);
    cache = await takeSnapshot();
    if (cache.protocol == null) {
      try {
        const pong = (await client.request("ping", {}, 2000)) as { protocol?: number };
        if (typeof pong.protocol === "number" && cache) cache.protocol = pong.protocol;
      } catch {
        /* the snapshot's protocol, if any, still stands */
      }
    }
    if (failed()) throw failed();
    emit();
    touch();
    cache = await openStatus(cache);
    if (failed()) throw failed();
    ready = true;
    if (again) {
      again = false;
      await refresh();
    }
    if (stopped || failed()) {
      if (failed()) throw failed();
      return;
    }
    try {
      await gate;
    } finally {
      endSession?.();
    }
  }

  /**
   * Protocol 23: subscribe first (session deltas, then status and model for every pane), take one snapshot, then
   * patch the cache from events. A version gap, another epoch or `events_lost` asks for `session.snapshot { since }`.
   * No debounced full snapshots and no per-pane subscription rebuilds.
   */
  async function syncSession() {
    const { gate, failed } = openGate();
    ready = false;
    const link = await openMux(await openConn());
    mux = link;
    let version = syncVersion;
    let epoch = syncEpoch;
    let synced = false;
    let catching = false;
    const early: SessionEvent[] = [];
    const keepLive = () => {
      if (!cache) return;
      for (const [paneId, live] of liveStatus) {
        if (now() - live.at > LIVE_STATUS_MS) {
          liveStatus.delete(paneId);
          continue;
        }
        const status = live.status as AgentInfo["agent_status"];
        for (const item of [...cache.agents, ...cache.panes]) if (item.pane_id === paneId) item.agent_status = status;
      }
    };
    const take = (result: SyncResult) => {
      if (result.type === "session_delta" && cache) {
        cache = applyChanges(cache, result.changes ?? []);
      } else {
        if (!result.snapshot?.workspaces) throw new Error("session.snapshot had no snapshot");
        cache = result.snapshot;
      }
      version = result.snapshot?.session_version ?? result.session_version ?? version;
      epoch = result.snapshot?.session_epoch ?? result.session_epoch ?? epoch;
      syncVersion = version;
      syncEpoch = epoch;
      keepLive();
    };
    const catchUp = () => {
      if (catching || !synced) return;
      catching = true;
      void link
        .request("session.snapshot", { since: version, epoch })
        .then((result) => {
          take(result as SyncResult);
          emit();
        })
        .catch((error: unknown) => fail(error instanceof Error ? error : new Error("session catch-up failed")))
        .finally(() => {
          catching = false;
        });
    };
    const handle = (event: SessionEvent) => {
      if (event.epoch !== epoch || event.version > version + 1) return catchUp();
      if (event.version <= version || !cache) return;
      cache = applyChanges(cache, event.changes ?? []);
      version = event.version;
      syncVersion = version;
      keepLive();
      emit();
    };
    await link.subscribe([{ type: "session.changed" }], (line) => {
      touch();
      if (line.error) return catchUp();
      const event = line.data as unknown as SessionEvent;
      if (!synced) early.push(event);
      else handle(event);
    });
    await link.subscribe([{ type: "pane.agent_status_changed" }, { type: "pane.agent_model_changed" }], (line) => {
      touch();
      if (line.error) return catchUp();
      if (!synced) return;
      if (line.event === "pane.agent_status_changed") patchStatus(line);
      else patchModel(line);
      emit();
    });
    if (caps?.events?.includes("accounts.changed")) {
      await link.subscribe([{ type: "accounts.changed" }], (line) => {
        touch();
        const accounts = (line.data as { accounts?: unknown[] } | undefined)?.accounts;
        if (Array.isArray(accounts)) for (const listener of accountListeners) listener(accounts);
      });
    }
    // After a reconnect, only what changed while the link was down (a full snapshot if Orcha restarted).
    take((await link.request("session.snapshot", cache && epoch ? { since: version, epoch } : {})) as SyncResult);
    synced = true;
    for (const event of early.splice(0)) handle(event);
    if (failed()) throw failed();
    emit();
    touch();
    syncCatchUp = catchUp;
    ready = true;
    void link.closed.then(() => fail(new Error("Orcha connection closed")));
    try {
      await gate;
    } finally {
      endSession?.();
    }
  }

  async function openConn(): Promise<Conn> {
    try {
      return await opts.connect();
    } finally {
      activePath = socketPath();
    }
  }

  function announceWaiting() {
    current = {
      ...current,
      orcha: { ...current.orcha, connected: false, socketPath: activePath },
    };
    opts.onState?.(current);
    if (!waitingAnnounced) {
      waitingAnnounced = true;
      opts.onWaiting?.();
    }
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timerId = setTimeout(() => {
        sleepWake = null;
        resolve();
      }, ms);
      sleepWake = () => {
        clearTimeout(timerId);
        sleepWake = null;
        resolve();
      };
    });
  }

  const watchdog = setInterval(() => {
    if (stopped || !ready) return;
    if (now() - lastBeat < watchdogMs) return;
    touch();
    // Protocol 23 pushes every change and reports gaps; a quiet connection is simply quiet.
    if (syncCatchUp) return;
    void refresh().catch((error: unknown) => {
      fail(error instanceof Error ? error : new Error("watchdog failed"));
    });
  }, Math.max(15, Math.min(5_000, watchdogMs)));

  void (async () => {
    let delay = 0;
    while (!stopped) {
      try {
        await session();
        delay = 0;
      } catch (error) {
        if (stopped) break;
        announceWaiting();
        if (delay === 0) {
          console.error(
            `Orcha link: ${error instanceof Error ? error.message : "disconnected"}; waiting to retry`,
          );
        }
        delay = delay === 0 ? backoffStart : Math.min(delay * 2, 5000);
        await sleep(delay);
      }
    }
  })();

  return {
    state: () => current,
    capabilities: () => caps,
    onAccounts(listener) {
      accountListeners.add(listener);
      return () => accountListeners.delete(listener);
    },
    request: (method, params, timeoutMs) => (mux ? mux.request(method, params, timeoutMs) : client.request(method, params, timeoutMs)),
    reemit() {
      if (cache) emit();
    },
    updateLocal(mutate) {
      opts.local.update(mutate);
      if (cache) emit();
    },
    dropSocket() {
      fail(new Error("socket dropped"));
    },
    stop() {
      stopped = true;
      clearInterval(watchdog);
      stopCatalog();
      endSession?.();
      closeAll();
      if (timer) clearTimeout(timer);
      sleepWake?.();
    },
  };
}
