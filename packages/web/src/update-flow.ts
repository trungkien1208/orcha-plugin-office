// Easy Job's own update, as the page walks it: offer → Owner clicks Update → Orcha rebuilds the plugin and restarts
// our bridge pane → the page reconnects, sees the new version from the server, and reloads onto the new build.
// Pure functions here; the store holds the state and does the I/O.
import type { AppUpdate, UpdateApplied, UpdateFailure } from "@easy-job/shared";

export type UpdateFlow =
  | { phase: "idle" }
  | { phase: "updating"; target: string; from: string; startedAt: number; answeredAt?: number }
  /** Orcha installed it but this bridge did not restart (it is not running as the plugin pane). */
  | { phase: "installed"; version: string }
  | { phase: "done"; version: string }
  | { phase: "failed"; target: string; error: string; log?: string };

export type UpdateNotice =
  | { kind: "offer"; version: string }
  | { kind: "incompatible"; version: string }
  | { kind: "updating"; version: string; slow: boolean }
  | { kind: "installed"; version: string }
  | { kind: "done"; version: string }
  | { kind: "failed"; version: string; error: string; log?: string };

export const IDLE: UpdateFlow = { phase: "idle" };
/** After Orcha answered, how long to wait for the restart before saying it needs a manual one. */
export const RESTART_WAIT_MS = 20_000;
/** When "Updating…" starts to say where to look. */
export const SLOW_MS = 90_000;
/** A saved "updating" older than this is dropped on load (the page was closed mid-update long ago). */
export const STALE_MS = 10 * 60_000;

/** What to show, or null. A missing capability (older Orcha) shows nothing, whatever else is known. */
export function noticeFor(update: AppUpdate | null, flow: UpdateFlow, dismissed: string | null, now: number): UpdateNotice | null {
  if (flow.phase === "updating") return { kind: "updating", version: flow.target, slow: now - flow.startedAt > SLOW_MS };
  if (flow.phase === "failed") return { kind: "failed", version: flow.target, error: flow.error, log: flow.log };
  if (flow.phase === "installed") return { kind: "installed", version: flow.version };
  if (flow.phase === "done") return { kind: "done", version: flow.version };
  if (!update?.supported || !update.available || !update.latest) return null;
  if (update.latest === update.running || dismissed === update.latest) return null;
  return update.compatible ? { kind: "offer", version: update.latest } : { kind: "incompatible", version: update.latest };
}

export function startUpdate(update: AppUpdate, now: number): UpdateFlow {
  if (!update.supported || !update.available || !update.compatible || !update.latest) return IDLE;
  return { phase: "updating", target: update.latest, from: update.running, startedAt: now };
}

/** Orcha answered `plugin.update` (or the call ended because it restarted us): keep waiting for the restart. */
export function applied(flow: UpdateFlow, result: UpdateApplied, now: number): UpdateFlow {
  if (flow.phase !== "updating") return flow;
  if (result.outcome === "restarting") return flow;
  return { ...flow, target: result.version, answeredAt: now };
}

export function failed(flow: UpdateFlow, failure: UpdateFailure): UpdateFlow {
  if (flow.phase !== "updating") return flow;
  return { phase: "failed", target: flow.target, error: failure.error, ...(failure.log ? { log: failure.log } : {}) };
}

/**
 * The server said hello. The new version from the server is the only proof the update worked; a restarted bridge
 * on the old version means it did not take.
 */
export function hello(flow: UpdateFlow, app: string | undefined, restarted: boolean): UpdateFlow {
  if (flow.phase !== "updating" || !app) return flow;
  if (app === flow.target) return { phase: "done", version: app };
  if (restarted && app === flow.from) {
    return { phase: "failed", target: flow.target, error: `Easy Job restarted but is still ${app}. Check the Easy Job pane in Orcha.` };
  }
  return flow;
}

/** Called every few seconds while updating. */
export function tick(flow: UpdateFlow, now: number, connected: boolean): UpdateFlow {
  if (flow.phase !== "updating" || flow.answeredAt == null || !connected) return flow;
  return now - flow.answeredAt > RESTART_WAIT_MS ? { phase: "installed", version: flow.target } : flow;
}

/** A saved flow from sessionStorage, if it is still worth showing. */
export function restore(raw: string | null, now: number): UpdateFlow {
  if (!raw) return IDLE;
  try {
    const flow = JSON.parse(raw) as UpdateFlow;
    if (flow.phase === "updating") return now - flow.startedAt < STALE_MS && typeof flow.target === "string" ? flow : IDLE;
    if (flow.phase === "done" && typeof flow.version === "string") return flow;
    return IDLE;
  } catch {
    return IDLE;
  }
}
