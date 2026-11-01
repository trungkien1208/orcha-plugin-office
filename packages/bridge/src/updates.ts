// Easy Job's own update state for the web: read from Orcha's daily cache when a link session starts, kept current
// by `plugin.updates_changed`, refreshed from GitHub only on the Owner's "Check now", applied only on their click.
import { noUpdate, type AppUpdate, type UpdateApplied } from "@easy-job/shared";
import { ActionError } from "./actions.ts";
import type { Capabilities, OfficeLink } from "./orcha/link.ts";
import { mapPluginUpdates, orchaPluginUpdate, orchaPluginUpdates, updatesSupported } from "./orcha/plugin-updates.ts";
import { APP_VERSION } from "./version.ts";

export type UpdateWatch = {
  current(): AppUpdate;
  /** Re-read Orcha's cache when the link reconnected (its capabilities object is new). Cheap to call often. */
  check(): void;
  /** Ask Orcha to check GitHub now. Only from an explicit click. */
  refresh(): Promise<AppUpdate>;
  /** Update Easy Job. Only from an explicit click; expect this process to be restarted. */
  apply(): Promise<UpdateApplied>;
  stop(): void;
};

export function watchUpdates(link: OfficeLink, onChange: (update: AppUpdate) => void, running = APP_VERSION): UpdateWatch {
  let update = noUpdate(running);
  let json = JSON.stringify(update);
  let seenCaps: Capabilities | null | undefined;
  let reading = 0;
  const set = (next: AppUpdate) => {
    const nextJson = JSON.stringify(next);
    if (nextJson === json) return;
    update = next;
    json = nextJson;
    onChange(next);
  };
  const stopEvents = link.onPluginUpdates?.((plugins) => {
    if (updatesSupported(link)) set(mapPluginUpdates(plugins, running));
  });
  return {
    current: () => update,
    check() {
      const caps = link.capabilities?.() ?? null;
      if (caps === seenCaps) return;
      seenCaps = caps;
      if (!updatesSupported(link)) {
        set(noUpdate(running));
        return;
      }
      const turn = ++reading;
      void orchaPluginUpdates(link, running)
        .then((next) => {
          if (turn === reading) set(next);
        })
        .catch(() => undefined);
    },
    async refresh() {
      if (!updatesSupported(link)) throw new ActionError(409, "This Orcha can't update plugins; run `orcha update` first");
      reading += 1;
      const next = await orchaPluginUpdates(link, running, true);
      set(next);
      return next;
    },
    async apply() {
      if (!updatesSupported(link)) throw new ActionError(409, "This Orcha can't update plugins; run `orcha update` first");
      const result = await orchaPluginUpdate(link);
      if (!result) throw new ActionError(409, "This Orcha can't update plugins");
      return result;
    },
    stop() {
      stopEvents?.();
    },
  };
}
