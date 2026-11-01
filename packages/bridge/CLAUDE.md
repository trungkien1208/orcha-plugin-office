# bridge

Bun, TypeScript, zod. `src/main.ts` starts the link and the server; `src/cli.ts` is the `easy-job` command (serve,
open, stop, status, doctor, autostart, orcha-plugin); `src/dev-fake.ts` runs everything against the fake Orcha in
`test/fake-orcha.ts` (port 4599). Tests are `bun test` files in `test/`; every behaviour change gets one.

## Pieces

- `orcha/transport.ts`: socket path resolution (re-read on every connect, so a late Orcha is found) and the NDJSON
  connection. The only place that touches sockets.
- `orcha/client.ts`: one request per connection, with timeout and `OrchaError` (protocol 22, and the capabilities probe).
- `orcha/mux.ts` + `orcha/delta.ts`: protocol 23 `server.multiplex` connection and session-delta application.
- `orcha/link.ts`: reads `server.capabilities`. With the sync API (protocol 23): one multiplexed connection, one
  `session.changed` and one all-pane status subscription, deltas patched in place, `snapshot { since, epoch }` on a
  gap or reconnect, no polling. Without it: the protocol 22 path (lifecycle + per-pane status subscription, ADR 0003,
  debounced snapshots, watchdog). Test report: `docs/orcha-sync-report.md`.
- `orcha/v24.ts`: protocol 24 behind feature detection (models, configure, accounts, plan/switch/login, hand-off,
  structured questions, mark seen). Each call returns null on an older Orcha so the caller keeps its old path.
- `state/reconcile.ts`: Orcha snapshot + local state → `OfficeState` (Projects, Agents, floor seats, counts).
  `state/local.ts` persists Seen marks, skins, waiting times, seats in `~/.easy-job/state.json`.
- `http/server.ts`: static files, token checks (`guard.ts`), versioned `state` pushes, heartbeat, conversation tails
  (follow the Agent's session, release when unwatched, retry a missing transcript, poll the terminal when there is none).
- `http/routes.ts`: the HTTP API; errors map to `{ error }` with 409 (blocked), 503 (Orcha not answering), 400, 500.
- `actions.ts`: every write to Orcha (prompt, keys, answer, interrupt, rename, start, close, broadcast, create Project).
- `conversation/`: read-only transcript parsers (Claude, Codex, Cursor) and the tailing watcher (ADR 0001).
- `context.ts`: fuel from Orcha's limits cache and git context for an Agent's folder (read-only, repo paths only).
  Git goes through `simple-git`, folder walks through `fdir` (async, capped: a project can be the home folder), and
  short-lived caches through `lru-cache` (git root 60 s, context 2 s, files 5 s, skills 30 s, Orcha accounts 2 s);
  do not spawn and parse `git` by hand.

## Rules

- Never modify Orcha; never read or return tokens; never touch the Keychain. Read-only Orcha files in use:
  `~/.config/orcha/config.json`, `claude-active`, `claude-accounts/*.json` (profile fields only), `~/.cache/orcha/limits/`.
- New Orcha-backed features go through one adapter module under `orcha/`, so a desktop app can swap it later (ADR 0005).
- Keep the transcript text out of logs and Activity (prompts are truncated there).
- One queue per Agent for writes (`lane()` in `actions.ts`); never interleave keys for the same pane.
- When a route changes shape, update `packages/shared` and the web in the same change (or the contract doc).
