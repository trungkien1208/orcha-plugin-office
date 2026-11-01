import type { AccountInfo, Capabilities } from "./accounts.ts";
import type { AgentSessionInfo, OrchaStatus } from "./orcha.ts";
import { fallbackCatalog, type SkinCatalog } from "./skins.ts";
import type { AppUpdate } from "./updates.ts";

/** Office status. `blocked` is shown as Needs me. `done` is a finish the Observer has not Seen. */
export type Status = OrchaStatus;

export type SkinId = string;

export type Project = {
  workspaceId: string;
  number: number;
  label: string;
  projectColor: string;
  terminalCount: number;
  cwd?: string;
};

export type Agent = {
  paneId: string;
  workspaceId: string;
  tabId: string;
  kind: string;
  displayAgent?: string;
  name: string;
  task?: string;
  stage?: string;
  /** Normalised work step from Orcha's stage words. Missing when the stage is empty or unknown. */
  stageStep?: StageStep;
  model?: string;
  /** Reasoning effort and Fast mode as Orcha observes them (protocol 24); missing when unknown. */
  effort?: string;
  fast?: boolean;
  /** Coarse model group for chips and portraits. `other` when neither the model nor the kind names one. */
  modelFamily?: ModelFamily;
  /** Status after Seen marks. */
  status: Status;
  orchaStatus: Status;
  completionSeq?: number;
  stateChangeSeq: number;
  /** Epoch ms when this Agent became Needs me. Kept until it leaves blocked. */
  waitingSince?: number;
  /** Stable identity: session id, else terminal id, else pane id. */
  agentKey: string;
  skin: SkinId;
  cwd?: string;
  session?: AgentSessionInfo;
  interactiveReady: boolean;
  launchPending: boolean;
  focused: boolean;
  /** Account this pane runs on. Missing until the bridge can see it. */
  accountId?: string;
  /** True when the 5-hour fuel window is under 10%. The reconciler always sets it. */
  lowFuel?: boolean;
};

export type OfficeCounts = {
  needsMe: number;
  done: number;
  working: number;
  projects: number;
};

export type DoneToday = { workspaceId: string; label: string; count: number };

/** Orcha socket protocols this build has been tested against (22: base API, 23: sync API, 24: models, accounts, plugins). */
export const ORCHA_PROTOCOL = 24;
export const ORCHA_PROTOCOLS_TESTED: readonly number[] = [22, 23, 24];

/** One line when the live protocol is not one we have tested. Missing means no warning. */
export function protocolWarning(protocol: number | undefined): string | undefined {
  if (protocol == null || ORCHA_PROTOCOLS_TESTED.includes(protocol)) return undefined;
  return `Orcha protocol ${protocol} is untested; some actions may fail`;
}

/** Floor and chips use one of these instead of Orcha's free-text stage. */
export type StageStep = "thinking" | "coding" | "testing" | "reviewing" | "finished";

const STAGE_RULES: Array<[RegExp, StageStep]> = [
  [/\b(running tests|testing|tests?)\b/, "testing"],
  [/\b(reviewing|review)\b/, "reviewing"],
  [/\b(finished|done|complete|completed)\b/, "finished"],
  [/\b(planning|thinking|plan)\b/, "thinking"],
  [/\b(editing|writing|coding|implementing|implementation)\b/, "coding"],
  // Protocol 24: "running Bash", "running apply_patch": a tool is working.
  [/\brunning\b/, "coding"],
];

/** Map Orcha's stage (and the usual synonyms) onto a step. Unknown or empty stays unset. */
export function stageStep(stage?: string): StageStep | undefined {
  const text = stage?.trim().toLowerCase();
  if (!text) return undefined;
  for (const [pattern, step] of STAGE_RULES) {
    if (pattern.test(text)) return step;
  }
  return undefined;
}

/** Model chip family. The model string wins; the agent kind fills in when Orcha sent no model. */
export type ModelFamily = "opus" | "sonnet" | "haiku" | "gpt" | "codex" | "cursor" | "other";

export function modelFamily(model?: string, kind?: string): ModelFamily {
  const text = (model ?? "").toLowerCase();
  const agent = (kind ?? "").toLowerCase();
  if (text.includes("opus")) return "opus";
  if (text.includes("sonnet")) return "sonnet";
  if (text.includes("haiku")) return "haiku";
  if (text.includes("gpt")) return "gpt";
  if (text.includes("codex") || agent === "codex") return "codex";
  if (text.includes("cursor") || agent === "cursor") return "cursor";
  return "other";
}

export type OfficeState = {
  orcha: {
    connected: boolean;
    socketPath: string;
    version?: string;
    protocol?: number;
    /** Set when `protocol` is present and not in `ORCHA_PROTOCOLS_TESTED`. The link keeps working. */
    protocolWarning?: string;
  };
  projects: Project[];
  agents: Agent[];
  counts: OfficeCounts;
  focused: {
    workspaceId?: string;
    tabId?: string;
    paneId?: string;
  };
  floor: FloorMemory;
  catalog: SkinCatalog;
  /** Finishes since local midnight, top 5 Projects. */
  kpi: { doneToday: DoneToday[] };
  /** What this Orcha can do. `accountApi` stays false until Orcha grows the socket methods. */
  capabilities: Capabilities;
  updatedAt: number;
};

/** One chair. Bench 0 is the Project's first Bench; bench 1 is tagged `name_1`. */
export type SeatPlace = { projectId: string; benchIndex: number; seat: number };

/** Persisted floor memory. There is no bench-size map. */
export type SavedFloor = { seats: Record<string, SeatPlace> };

export type FloorMemory = {
  /** workspace id → desk count the live layout is using. Not stored. */
  benches: Record<string, number>;
  /** agentKey → desk index in that live layout. Not stored. */
  seats: Record<string, number>;
};

export type LocalState = {
  version: 1;
  /** agentKey → completion_seq the Observer has Seen */
  seen: Record<string, number>;
  /** agentKey → skin override */
  skins: Record<string, SkinId>;
  /** agentKey → first time the Agent was Needs me */
  waitingSince: Record<string, number>;
  floor: SavedFloor;
};

export type ActivityKind = "status" | "action";

export type ActivityEntry = {
  id: string;
  at: number;
  kind: ActivityKind;
  text: string;
  paneId?: string;
  agentKey?: string;
  workspaceId?: string;
};

export type ConversationRole = "user" | "agent" | "tool" | "system";

export type ConversationItem = {
  id: string;
  at: number;
  role: ConversationRole;
  text?: string;
  tool?: { name: string; summary: string; ok?: boolean; detail?: string };
  images?: Array<{ mime: string; dataUrl: string }>;
};

export type ServerMessage =
  | { type: "hello"; bridgeId: string; serverTime: number; version: number; /** Easy Job version of this bridge. */ app?: string }
  | { type: "state"; version: number; state: OfficeState }
  | { type: "ping"; at: number }
  | { type: "activity"; entry: ActivityEntry }
  | { type: "conversation"; paneId: string; items: ConversationItem[]; reset?: boolean; terminal?: boolean }
  | { type: "accounts"; accounts: AccountInfo[] }
  | { type: "update"; update: AppUpdate }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "watch-conversation"; paneId: string }
  | { type: "unwatch-conversation"; paneId: string };

export function emptyLocal(): LocalState {
  return { version: 1, seen: {}, skins: {}, waitingSince: {}, floor: { seats: {} } };
}

export function emptyOffice(socketPath: string, now = Date.now()): OfficeState {
  return {
    orcha: { connected: false, socketPath },
    projects: [],
    agents: [],
    counts: { needsMe: 0, done: 0, working: 0, projects: 0 },
    focused: {},
    floor: { benches: {}, seats: {} },
    catalog: fallbackCatalog(),
    kpi: { doneToday: [] },
    capabilities: { accountApi: false, handoff: false },
    updatedAt: now,
  };
}

/** Account fuel: % left per usage window, read from Orcha's local usage cache. */
export type FuelWindow = { key: string; label: string; left: number; resetAt?: number };
export type Fuel = { account: string; label: string; windows: FuelWindow[]; note?: string };

export type GitChange = { status: string; path: string; add: number; del: number };
export type GitContext = {
  root: string;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changes: GitChange[];
  added: number;
  removed: number;
  history: Array<{ sha: string; subject: string; at: number; author: string }>;
  worktrees: Array<{ path: string; branch: string; current: boolean }>;
};
