// Easy Job's own updates through Orcha's plugin manager (Orcha 0.11, protocol 24), behind feature detection.
// Orcha checks GitHub once a day; `plugin.updates` answers from that cache, so nothing here goes online unless the
// Owner asks for a check (`refresh`). `plugin.update` restarts this bridge's own pane, so its answer may never come.
import { noUpdate, type AppUpdate, type UpdateApplied } from "@easy-job/shared";
import type { OfficeLink } from "./link.ts";

export const PLUGIN_ID = "easy-job";

type OrchaPluginUpdate = {
  id?: string;
  current_version?: string;
  latest_version?: string;
  update_available?: boolean;
  compatible?: boolean;
  needs_herdr_version?: string;
};

/** Every piece the update flow needs; an older Orcha without them gets no update UI at all. */
export function updatesSupported(link: OfficeLink): boolean {
  const caps = link.capabilities?.();
  return (
    !!caps?.methods?.includes("plugin.updates") &&
    !!caps.methods.includes("plugin.update") &&
    !!caps.features?.includes("plugin.updates")
  );
}

/** Easy Job's row from a `plugin_updates` result or a `plugin_updates_changed` event. */
export function mapPluginUpdates(plugins: unknown, running: string): AppUpdate {
  const rows = Array.isArray(plugins) ? (plugins as OrchaPluginUpdate[]) : [];
  const row = rows.find((item) => item && typeof item === "object" && item.id === PLUGIN_ID);
  if (!row) return { ...noUpdate(running), supported: true };
  return {
    supported: true,
    running,
    installed: row.current_version,
    latest: row.latest_version,
    available: row.update_available === true && !!row.latest_version,
    compatible: row.compatible !== false,
    ...(row.needs_herdr_version ? { needsHerdrVersion: row.needs_herdr_version } : {}),
  };
}

/** `plugin.updates`; `refresh` asks GitHub now (slow), so only an explicit click passes it. */
export async function orchaPluginUpdates(link: OfficeLink, running: string, refresh = false): Promise<AppUpdate> {
  if (!updatesSupported(link)) return noUpdate(running);
  const result = (await link.request("plugin.updates", refresh ? { refresh: true } : {}, refresh ? 60_000 : 10_000)) as {
    plugins?: unknown;
  };
  return mapPluginUpdates(result?.plugins, running);
}

/** Errors that mean Orcha restarted us mid-call rather than refused the update. */
const RESTART_CODES = new Set(["closed", "timeout", "ECONNRESET", "EPIPE"]);

/**
 * `plugin.update` for Easy Job. Call it only from the Owner's click. Orcha restarts this bridge's pane during or
 * right after the call, so a closed connection counts as "restarting", not as a failure.
 */
export async function orchaPluginUpdate(link: OfficeLink): Promise<UpdateApplied | null> {
  if (!updatesSupported(link)) return null;
  try {
    const result = (await link.request("plugin.update", { id: PLUGIN_ID }, 10 * 60_000)) as { version?: string };
    return result?.version ? { outcome: "updated", version: result.version } : { outcome: "restarting" };
  } catch (error) {
    // OrchaError carries Orcha's code (`plugin_update_failed`…); socket errors carry Node's.
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && RESTART_CODES.has(code)) return { outcome: "restarting" };
    throw error;
  }
}
