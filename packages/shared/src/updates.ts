/**
 * Easy Job's own update, as Orcha's plugin manager reports it (`plugin.updates`, Orcha 0.11). Easy Job never goes
 * online itself: Orcha checks GitHub once a day and the bridge only relays its cached answer.
 */
export type AppUpdate = {
  /** False on an Orcha without `plugin.updates`: the web shows no update UI at all. */
  supported: boolean;
  /** Version of the bridge that is running now (the one serving this page). */
  running: string;
  /** Installed plugin version, as Orcha reads it. */
  installed?: string;
  /** Version on the plugin's source and ref at Orcha's last check. */
  latest?: string;
  available: boolean;
  /** False when the latest version needs a newer Herdr core than this Orcha has. */
  compatible: boolean;
  needsHerdrVersion?: string;
};

/** `POST /api/update/apply`: Orcha answered with the new version, or the connection closed because it restarted us. */
export type UpdateApplied = { outcome: "updated"; version: string } | { outcome: "restarting" };

/** Error body of `POST /api/update/apply`. `log` is the tail of the build log for `plugin_update_failed`. */
export type UpdateFailure = { error: string; code: string; log?: string };

export const noUpdate = (running: string): AppUpdate => ({ supported: false, running, available: false, compatible: true });
