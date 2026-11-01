import { allowSound, type ActivityEntry, type ClientMessage, type ConversationItem, type OfficeState, type ServerMessage, type Status, type StructuredQuestion } from "@easy-job/shared";
import { pushAccounts } from "./queries.ts";
import type { AccountInfo } from "./api-accounts.ts";
import { api, loadToken, token } from "./api.ts";

export type SettingsSection = "general" | "accounts" | "boss" | "connection";
export type Route = { name: "home" } | { name: "conversation"; paneId: string } | { name: "settings"; section: SettingsSection };

export type AppSnap = {
  office: OfficeState | null;
  socket: "connecting" | "open" | "closed";
  reconnectAt?:number;
  tokenMissing: boolean;
  activity: ActivityEntry[];
  route: Route;
  projectId: string;
  paneId: string | null;
  conversations: Record<string, { items: ConversationItem[]; terminal: boolean }>;
  question: string;
  /** The Question as data when Orcha offers it (protocol 24); null means read options from the text. */
  questionData: StructuredQuestion | null;
  error: string | null;
  muted: boolean;
  soundUnlocked: boolean;
  reopen: boolean;
  pending: { paneId: string; status: Status; since: number; note: string } | null;
  /** Look of the Floor and the shell: the scam compound or a cozy office. */
  theme: Theme;
  /** Calm mode: no flicker, shake, fire or gags; needs-you is a quiet dot. */
  calm: boolean;
};

export type Theme = "compound" | "office";

function storedTheme(): Theme {
  try {
    return localStorage.getItem("easy-job-theme") === "office" ? "office" : "compound";
  } catch {
    return "compound";
  }
}

/** The theme and calm mode live on <html> so CSS can restyle everything. */
function applyLook(theme: Theme, calm: boolean) {
  document.documentElement.dataset.theme = theme;
  if (calm) document.documentElement.dataset.calm = "";
  else delete document.documentElement.dataset.calm;
}

function storedFlag(key: string, oldKey: string): boolean {
  const next = localStorage.getItem(key);
  if (next != null) return next === "1";
  const old = localStorage.getItem(oldKey);
  if (old == null) return false;
  localStorage.setItem(key, old);
  localStorage.removeItem(oldKey);
  return old === "1";
}

type Listener = () => void;
const listeners = new Set<Listener>();
let snap: AppSnap = {
  office: null,
  socket: "connecting",
  tokenMissing: false,
  activity: [],
  route: readRoute(),
  projectId: "all",
  paneId: null,
  conversations: {},
  question: "",
  questionData: null,
  error: null,
  muted: storedFlag("easy-job-muted", "orcha-office-muted"),
  soundUnlocked: false,
  reopen: false,
  pending: null,
  theme: storedTheme(),
  calm: storedFlag("easy-job-calm", "easy-job-calm"),
};
applyLook(snap.theme, snap.calm);
let prevCounts = { needsMe: 0, done: 0 };
const sounds = new Map<string, HTMLAudioElement>();
const soundLast = new Map<string, number>();
let seenVersion = -1;
let bridgeId = "";
let clockOffset = 0;
let leader = true;
const tabId = crypto.randomUUID();
const soundChannel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("easy-job");
soundChannel?.addEventListener("message", (event) => {
  const data = event.data as { type?: string; id?: string };
  if (data?.id === tabId) return;
  if (data?.type === "claim") leader = false;
  if (data?.type === "resign") leader = document.visibilityState === "visible" && document.hasFocus();
});

export function serverNow(): number {
  return Date.now() + clockOffset;
}

export function unlockSound() {
  if (!snap.soundUnlocked) patch({ soundUnlocked: true });
}

// Browsers allow audio only after a user gesture: the first click or key anywhere counts, no button needed.
if (typeof window !== "undefined") {
  const first = () => { unlockSound(); window.removeEventListener("pointerdown", first, true); window.removeEventListener("keydown", first, true); };
  window.addEventListener("pointerdown", first, true);
  window.addEventListener("keydown", first, true);
}

function claimLeader() {
  if (document.visibilityState !== "visible") return;
  leader = true;
  soundChannel?.postMessage({ type: "claim", id: tabId });
}

function emit() {
  for (const listener of listeners) listener();
}
function patch(partial: Partial<AppSnap>) {
  snap = { ...snap, ...partial };
  emit();
}

export function getSnap(): AppSnap {
  return snap;
}
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readRoute(): Route {
  const hash = location.hash.replace(/^#/, "");
  if (hash.startsWith("conversation/")) return { name: "conversation", paneId: decodeURIComponent(hash.slice("conversation/".length)) };
  if (hash.startsWith("settings")) {
    const section = hash.slice("settings/".length);
    return { name: "settings", section: section === "accounts" || section === "boss" || section === "connection" ? section : "general" };
  }
  return { name: "home" };
}

export function go(route: Route) {
  location.hash = route.name === "home" ? "#home" : route.name === "settings" ? `#settings/${route.section}` : `#conversation/${encodeURIComponent(route.paneId)}`;
  patch({ route });
}

export function selectProject(projectId: string) {
  patch({ projectId, paneId: null, question: "", questionData: null });
}
/** agentKey → the stateChangeSeq you last saw in its chat; newer means "new since you looked". */
const readSeq: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem("easy-job-read") ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
})();
let readDirty = false;
function markRead(agent: { agentKey: string; stateChangeSeq: number }) {
  if (readSeq[agent.agentKey] === agent.stateChangeSeq) return;
  readSeq[agent.agentKey] = agent.stateChangeSeq;
  readDirty = true;
}
function saveRead() {
  if (!readDirty) return;
  readDirty = false;
  try { localStorage.setItem("easy-job-read", JSON.stringify(readSeq)); } catch { /* per-browser convenience */ }
}

/** True when the Agent changed since you last had its chat open (not for the one open now). */
export function isUnread(agent: { agentKey: string; paneId: string; stateChangeSeq: number }): boolean {
  if (agent.paneId === snap.paneId) return false;
  const seen = readSeq[agent.agentKey];
  return seen !== undefined && agent.stateChangeSeq > seen;
}

export function selectPane(paneId: string | null) {
  const agent = paneId ? snap.office?.agents.find((item) => item.paneId === paneId) : undefined;
  if (agent) { markRead(agent); saveRead(); }
  if (snap.paneId && snap.paneId !== paneId && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "unwatch-conversation", paneId: snap.paneId } satisfies ClientMessage));
  }
  patch({ paneId, question: "", questionData: null, error: null });
  if (paneId) {
    void watch(paneId);
    void loadQuestion(paneId);
    void api(`/api/agents/${encodeURIComponent(paneId)}/seen`, { method: "POST" }).catch(() => undefined);
  }
}

async function loadQuestion(paneId: string) {
  const agent = snap.office?.agents.find((item) => item.paneId === paneId);
  if (agent?.status !== "blocked") {
    if (snap.paneId === paneId) patch({ question: "", questionData: null });
    return;
  }
  try {
    const body = await api<{ text: string; question?: StructuredQuestion }>(`/api/agents/${encodeURIComponent(paneId)}/question`);
    if (snap.paneId === paneId) patch({ question: body.text || body.question?.text || " ", questionData: body.question ?? null });
  } catch (error) {
    if (snap.paneId === paneId) patch({ error: error instanceof Error ? error.message : "Could not read the Question" });
  }
}

function applyOffice(office: OfficeState) {
  if (office.counts.needsMe > prevCounts.needsMe) void play("request");
  if (office.counts.done > prevCounts.done) void play("done");
  if (office.counts.needsMe > prevCounts.needsMe && document.hidden && !snap.calm && Notification.permission === "granted") {
    new Notification("Easy Job", { body: "An Agent needs you" });
  }
  prevCounts = { needsMe: office.counts.needsMe, done: office.counts.done };
  // First sight counts as read; the open chat stays read as it changes.
  for (const agent of office.agents) if (readSeq[agent.agentKey] === undefined || agent.paneId === snap.paneId) markRead(agent);
  saveRead();
  document.title = office.counts.needsMe ? `(${office.counts.needsMe}) Easy Job` : "Easy Job";
  const paneId = snap.paneId;
  const blocked = paneId ? office.agents.find((agent) => agent.paneId === paneId)?.status === "blocked" : false;
  const pending = snap.pending && office.agents.find((agent) => agent.paneId === snap.pending?.paneId)?.status !== snap.pending.status
    ? null
    : snap.pending;
  patch({ office, question: blocked ? snap.question : "", questionData: blocked ? snap.questionData : null, pending });
  if (blocked && paneId && !snap.question) void loadQuestion(paneId);
}

async function play(name: "request" | "done") {
  // Calm mode is silent: no alert sounds (the Floor gong follows muted, set below).
  if (snap.muted || snap.calm || !snap.soundUnlocked || !leader) return;
  if (!allowSound(soundLast, name, Date.now())) return;
  try {
    let audio = sounds.get(name);
    if (!audio) {
      const response = await fetch(`/api/sounds/${name}.mp3`, { headers: { authorization: `Bearer ${token() ?? ""}` } });
      if (!response.ok) return;
      audio = new Audio(URL.createObjectURL(await response.blob()));
      sounds.set(name, audio);
    }
    audio.currentTime = 0;
    await audio.play();
  } catch {
    /* autoplay or a missing file stays quiet */
  }
}

export function setMuted(muted: boolean) {
  localStorage.setItem("easy-job-muted", muted ? "1" : "0");
  patch({ muted });
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem("easy-job-theme", theme); } catch { /* per-browser convenience */ }
  applyLook(theme, snap.calm);
  patch({ theme });
}

export function setCalm(calm: boolean) {
  try { localStorage.setItem("easy-job-calm", calm ? "1" : "0"); } catch { /* per-browser convenience */ }
  applyLook(snap.theme, calm);
  patch({ calm });
}

export async function askNotifications() {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
}

let socket: WebSocket | null = null;
let retry = 500;
let silence: number | undefined;

function heard() {
  window.clearTimeout(silence);
  silence = window.setTimeout(() => socket?.close(), 35_000);
}

export function markSent(paneId: string) {
  const status = snap.office?.agents.find((agent) => agent.paneId === paneId)?.status ?? "unknown";
  patch({ pending: { paneId, status, since: Date.now(), note: "sent…" } });
  window.setTimeout(() => {
    if (snap.pending?.paneId === paneId && snap.pending.note === "sent…") {
      patch({ pending: { ...snap.pending, note: "No change seen yet" } });
    }
  }, 10_000);
}

let reconnectTimer:ReturnType<typeof setTimeout>|undefined;
export function retryConnection(){clearTimeout(reconnectTimer);const old=socket;socket=null;old?.close();connect();}
function connect() {
  clearTimeout(reconnectTimer);
  const auth = token();
  if (!auth) {
    patch({ tokenMissing: true, socket: "closed" });
    return;
  }
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const connecting = new WebSocket(`${protocol}://${location.host}/ws`, [`easy-job.${auth}`]);
  socket=connecting;
  socket.addEventListener("open", () => {
    if(socket!==connecting)return;
    retry = 500;
    heard();
    patch({ socket: "open", tokenMissing: false });
    void api<OfficeState>("/api/state").then(applyOffice).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("401")) patch({ tokenMissing: true, reopen: true, socket: "closed" });
    });
    void api<ActivityEntry[]>("/api/activity").then((activity) => patch({ activity })).catch(() => undefined);
    if (snap.paneId) socket?.send(JSON.stringify({ type: "watch-conversation", paneId: snap.paneId } satisfies ClientMessage));
  });
  socket.addEventListener("message", (event) => {
    if(socket!==connecting)return;
    heard();
    const incoming = JSON.parse(String(event.data)) as ServerMessage|{type:"accounts";accounts:AccountInfo[]};
    if(incoming.type==="accounts"){pushAccounts(incoming.accounts);return;}
    const message=incoming;
    if (message.type === "hello") {
      clockOffset = message.serverTime - Date.now();
      if (bridgeId && bridgeId !== message.bridgeId) {
        seenVersion = -1;
        patch({ conversations: {}, activity: [] });
        void api<ActivityEntry[]>("/api/activity").then((activity) => patch({ activity })).catch(() => undefined);
        if (snap.paneId) void watch(snap.paneId);
      }
      bridgeId = message.bridgeId;
    }
    if (message.type === "ping") return;
    if (message.type === "state") {
      if (message.version <= seenVersion) return;
      seenVersion = message.version;
      applyOffice(message.state);
    }
    if (message.type === "activity") patch({ activity: [message.entry, ...snap.activity].slice(0, 200) });
    if (message.type === "conversation") {
      const current = snap.conversations[message.paneId]?.items ?? [];
      const items = message.reset ? message.items : merge(current, message.items);
      patch({
        conversations: {
          ...snap.conversations,
          [message.paneId]: { items, terminal: message.terminal ?? snap.conversations[message.paneId]?.terminal ?? false },
        },
      });
    }
    if (message.type === "error") patch({ error: message.message });
  });
  socket.addEventListener("close", () => {
    if(socket!==connecting)return;
    patch({ socket: "closed", reconnectAt:Date.now()+retry });
    reconnectTimer=setTimeout(connect, retry);
    retry = Math.min(retry * 2, 5000);
  });
}

function merge(current: ConversationItem[], incoming: ConversationItem[]): ConversationItem[] {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()];
}

export async function watch(paneId: string) {
  // Subscribe first: a failed terminal snapshot must not prevent live updates.
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "watch-conversation", paneId } satisfies ClientMessage));
  }
  const initial = snap.conversations[paneId];
  const after = initial?.terminal ? undefined : initial?.items.at(-1)?.id;
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  let page: { items: ConversationItem[]; terminal: boolean };
  try {
    page = await api(`/api/agents/${encodeURIComponent(paneId)}/conversation${query}`);
  } catch {
    // The subscribed tail keeps retrying while Orcha is busy or reconnecting.
    return;
  }
  if (snap.conversations[paneId] !== initial) return;
  const current = snap.conversations[paneId]?.items ?? [];
  const items = after ? merge(current, page.items) : page.items;
  patch({ conversations: { ...snap.conversations, [paneId]: { items, terminal: page.terminal } } });
}

export function boot() {
  const auth = loadToken();
  if (!auth) {
    patch({ tokenMissing: true, socket: "closed" });
    return;
  }
  window.addEventListener("hashchange", () => patch({ route: readRoute() }));
  window.addEventListener("focus", claimLeader);
  window.addEventListener("pagehide", () => soundChannel?.postMessage({ type: "resign", id: tabId }));
  claimLeader();
  // Validate the token even when an unauthorized websocket cannot open.
  void api<OfficeState>("/api/state").then(applyOffice).catch((error:unknown)=>{
    if(error instanceof Error&&error.message.includes("401"))patch({tokenMissing:true,reopen:true,socket:"closed"});
  });
  connect();
}
