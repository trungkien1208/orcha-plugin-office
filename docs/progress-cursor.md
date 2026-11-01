# Cursor backend progress (batch 1)

Worktree `be/batch1`. `packages/web` is left for Codex. `bun run check` after each task. Nothing pushed.

| Task | Commit | What landed |
|---|---|---|
| C1 | `ee1d185` | Shared account types, `capabilities` on the office, and stub routes. Keychain switch is 501. |
| C2 | `4dbda4c` | Accounts come from Orcha's config, profiles, and fuel cache. Email and plan only. The socket pushes `accounts`. |
| C3 | `378d7ed` | `/model` sends the slash command when idle, and keeps one queued name until then. |
| C4 | `24560e1` | Restart switch sends ctrl-c twice and a resume line. Keychain stays 501. A session file is linked, never moved. |
| C5 | `31660fe` | Sign-in opens an unfocused tab and runs the account's login command. |
| C6 | `02196d8` | Hand off runs `handoff.py` with `HERDR_BIN_PATH`. `capabilities.handoff` is true only when that script exists. An account folder is passed as `CLAUDE_CONFIG_DIR`. |
| C7 | `05a26cd` | A prompt to several Agents carries the Owner header. The Project thread merges transcripts by time and marks agent-to-agent prompts. Nothing is forwarded automatically. |

## For Codex

New shared types in `packages/shared/src/accounts.ts`: `AccountKind`, `FuelWindowInfo`, `AccountInfo`, `SwitchMode`, `SwitchPlan`, `Capabilities`.

On existing types:

- `OfficeState.capabilities` (`accountApi` is false; `handoff` is true only when `handoff.py` is installed).
- `Agent.accountId?` and `Agent.lowFuel?` (the reconciler sets `lowFuel`).
- Server message `{ type: "accounts"; accounts: AccountInfo[] }`.

Routes: `GET /api/accounts`, `POST /api/agents/:pane/model`, `POST /api/agents/:pane/account/plan`, `POST /api/agents/:pane/account`, `POST /api/accounts/:id/login`, `POST /api/agents/:pane/handoff`, `POST /api/projects/:ws/prompt`, `GET /api/projects/:ws/thread`. Keychain switch is `501` with `Orcha has no account API yet`.
