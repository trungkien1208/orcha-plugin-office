# Plan: Easy Job as an Orcha plugin now, one desktop app later (2026-10-31)

Decision: `docs/adr/0005-plugin-now-one-app-later.md`.

## Phase 1: install Orcha → Easy Job is there

Goal: a fresh Orcha install **offers** Easy Job; the user decides. Once chosen, one key opens it and nothing else is needed (no Bun on the user's machine). Never installed, linked or started without the user saying yes, and removing it is one step.

**Easy Job side (Cursor, this repo):**
- P1 Release artifacts: `bun run release` builds the web bundle and the compiled `easy-job` binary for macOS arm64/x64 and Linux x64 into `dist/release/<platform>/` (binary + `web/` next to it), with a `SHA256SUMS` file and a version from `package.json`.
- P2 Plugin manifest (`integrations/orcha-plugin/herdr-plugin.toml`):
  - the binary path comes from the plugin directory (`$HERDR_PLUGIN_DIR/bin/easy-job`), not from PATH;
  - actions: Open Easy Job (keybinding suggestion `prefix E`), Easy Job status, Stop;
  - the server pane stays hidden from the Floor (already by token);
  - optional `[[startup]]` hook that starts the bridge with Orcha only when the plugin setting `autostart = true` (default false);
  - a link handler so `easy-job://open?pane=<id>` from Orcha's UI opens that Agent's chat.
- P3 The bridge reads Orcha's injected environment first (`HERDR_SOCKET_PATH`, `HERDR_BIN_PATH`, plugin config/state dirs) and keeps its own state in the plugin state dir when run as a plugin.
- P4 `easy-job doctor` checks the plugin install (manifest version, binary checksum, web folder) and prints the fix.
- P5 Docs: README "Install with Orcha" and "Update", and a troubleshooting section.

**Orcha side (the Owner's fork, done in the Orcha repo when ready):**
- O1 Offer the plugin, opt-in: the installer and the first run ask "Add Easy Job, a visual office for your agents? (y/N)", default **no**. Yes → download (or use the bundled copy of) the Easy Job release for the platform, verify its checksum, `plugin.link` it. No → never ask again unless the user runs `orcha office install` or picks it in Orcha's plugin list.
- O1b Easy to change your mind: `orcha office install` / `orcha office remove` (unlinks the plugin, stops the bridge, keeps or deletes `~/.easy-job` on a second question), and the same in Orcha's plugin list.
- O2 `orcha office` CLI alias for the plugin's open action, and a menu item in Orcha's UI.
- O3 Socket API additions Easy Job needs (accounts, pane output stream, see `docs/orcha-api-gaps.md`).
- O4 A setting "Start Easy Job with Orcha", off by default (only shown once the plugin is installed).

## Phase 2: one desktop app (later)

A Tauri app that ships Orcha's server and the Easy Job UI together:
1. Shell: the app starts Orcha's server and the `easy-job` bridge as child processes and opens the UI in its window; dock/tray icon, native notifications, launch at login, auto-update.
2. Terminal in the app: xterm.js tabs showing Orcha panes over a pane output/input stream on the socket (O3), so "Open in Orcha" becomes "open terminal tab". Orcha's TUI still works as a second client of the same server.
3. Fold the bridge in, step by step: account, hand off and worktree calls go to Orcha directly through Tauri commands (Rust, Apache-2.0 fork), the TypeScript bridge shrinks.
4. Release: signing and notarization on macOS, Windows after Orcha's Windows build is stable.

## Rules that keep Phase 2 cheap (apply from batch 1 on)

- No app store or API imports inside `packages/web/src/floor` (theme and settings come in through `FloorInput`). Today only `floor/Portrait.tsx` breaks this; fix it in batch 1.
- Orcha-specific code only in `packages/bridge/src/orcha/` and `state/reconcile.ts`; new features call Orcha through one adapter module.
- Art and manifest travel with the Floor module.
- Everything the UI needs from Orcha goes through documented routes (`docs/batch1.md` contract style), never through private file reads that a desktop app could not reproduce, except the read-only Orcha files already in use (config.json, limits cache).
