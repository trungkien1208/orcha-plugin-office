# Batch 1: accounts and models on the web, hand off, agent teams, connection popup (2026-10-31)

Source plans: `docs/plan-accounts-team.md` (read its guards) and `docs/plan-next-features.md` §1. Cursor does the backend, Codex the UI, **in separate worktrees**, both against the contract below. Claude reviews and merges.

## Setup (each agent, before the first task)

Start only after your previous task list is committed.
- Cursor: `git worktree add ../PartyAgent-2-be -b be/batch1 build/orcha-office`, work only in `../PartyAgent-2-be`.
- Codex: `git worktree add ../PartyAgent-2-ui -b ui/batch1 build/orcha-office`, work only in `../PartyAgent-2-ui`.
- Run `bun install` in the new worktree. Never commit in the other agent's worktree or on `build/orcha-office`. No push.
- Progress goes to your own file: `docs/progress-cursor.md` / `docs/progress-codex.md` (not PROGRESS.md).
- Ports: Codex may run `bun run dev:fake` (4599) for screenshots; Cursor uses tests only.

## Keep it merge-ready (docs/adr/0005-plugin-now-one-app-later.md)

- No app store or API imports inside `packages/web/src/floor`; Codex fixes `floor/Portrait.tsx` (theme via props) as part of K1.
- Orcha-specific code only in `packages/bridge/src/orcha/` and `state/reconcile.ts`; Cursor routes the new account/hand-off calls through one adapter module there.

## Contract (both build against this; Cursor implements it, Codex consumes it)

Shared types in `packages/shared/src/accounts.ts`, exported from the package index:

```ts
export type AccountKind = "claude" | "codex" | "cursor" | "other";
export type FuelWindowInfo = { key: string; label: string; left: number; resetAt?: number };
export type AccountInfo = {
  id: string; label: string; kind: AccountKind;
  email?: string; plan?: string;          // from claude-accounts/<id>.json, never tokens
  dir?: string;                           // expanded config folder; undefined = default (~/.claude)
  signedIn: boolean;                      // a sign-in exists for this account
  active: boolean;                        // Orcha's default (claude-active)
  fuel: FuelWindowInfo[];                 // from ~/.cache/orcha/limits/<id>.json
  panes: string[];                        // paneIds of Agents currently on this account
};
export type SwitchMode = "keychain" | "restart" | "handoff";
export type SwitchPlan = {               // answer of a dry run, shown before switching
  mode: SwitchMode;
  allowed: boolean; reason?: string;      // e.g. "Orcha has no account API yet"
  alsoMoves: string[];                    // paneIds sharing the folder (keychain mode)
  sessionLinked?: boolean;                // restart: session file present or linkable in the new folder
  needsIdle: boolean;                     // restart: the Agent is working right now
};
export type Capabilities = { accountApi: boolean; handoff: boolean };
```

Additions to existing types:
- `OfficeState.capabilities: Capabilities`.
- `Agent.accountId?: string` (the account the pane runs on) and `Agent.lowFuel: boolean` (5-hour fuel under 10 %).
- `ServerMessage` gains `{ type: "accounts"; accounts: AccountInfo[] }` pushed when accounts or fuel change.

Routes (token required, JSON, errors as `{ error }` with the status codes below):

| Method and path | Body | Answer |
|---|---|---|
| `GET /api/accounts` | | `AccountInfo[]` |
| `POST /api/agents/:pane/model` | `{ model }` | `{ queued: boolean }`; 409 when blocked on a question |
| `POST /api/agents/:pane/account/plan` | `{ accountId, mode }` | `SwitchPlan` (dry run, changes nothing) |
| `POST /api/agents/:pane/account` | `{ accountId, mode, moveAll?, whenIdle? }` | `{ ok: true, paneId }` (handoff: the new paneId); 501 for keychain until Orcha has the API; 409 if busy and `whenIdle` is not set |
| `POST /api/accounts/:id/login` | | `{ paneId }` of the Orcha tab running the sign-in |
| `POST /api/agents/:pane/handoff` | `{ to: { kind?, accountId? }, mode: "full" \| "summary" }` | `{ paneId }` of the new Agent |
| `POST /api/projects/:ws/prompt` | `{ to: string[], text }` (paneIds, 1–5) | `{ results: { paneId, ok, error? }[] }` |
| `GET /api/projects/:ws/thread?before=&limit=` | | `{ items: (ConversationItem & { paneId: string; from?: string })[] }` newest last; `from` = sender paneId for agent→agent prompts |

Until Cursor's branch is merged, Codex mocks these in the UI behind one module (`packages/web/src/api-accounts.ts`) that falls back to "feature unavailable" on 404, never crashes.

## Cursor (backend), in order

- **C1 Contract**: the shared types and additions above, routes as stubs returning real data where cheap, tests for the types' builders. Commit this first.
- **C2 Accounts**: read `~/.config/orcha/config.json` accounts (plus detected Claude/Codex/Cursor when missing, like Orcha), profiles from `claude-accounts/<id>.json` (email, plan only), `claude-active`, fuel cache, and which panes use which account (pane `CLAUDE_CONFIG_DIR` via `ps -E`, as `context.ts` does). `GET /api/accounts`, the `accounts` push, `Agent.accountId`, `Agent.lowFuel`. Never read or return tokens; never touch the Keychain.
- **C3 Model**: `/model` route sends `/model <name>` as a prompt when idle, queues it until idle otherwise (one pending model per Agent); validate the name (`^[\w.:/-]{1,80}$`).
- **C4 Switch**: plan + switch for `restart` (Ctrl+C twice, wait for the shell, `CLAUDE_CONFIG_DIR=<dir> claude --resume <session>`; default account without the variable; Codex/Cursor: their resume line) with the guards: session file check and symlink (never move), busy → 409 or queue with `whenIdle`, `alsoMoves` computed for keychain plans. `keychain` returns 501 with the reason; `capabilities.accountApi` false. `handoff` mode delegates to C6.
- **C5 Sign in**: new Orcha tab in the Agent's Project (or the first Project) with `focus: false`, run `claude auth login` with the account's `CLAUDE_CONFIG_DIR` (Codex/Cursor: their login command).
- **C6 Hand off**: run Orcha's `~/.config/orcha/scripts/handoff.py <pane> <agent> <mode>` with `HERDR_BIN_PATH` pointing at the Orcha binary; when the target is an account, start the new agent under that account; return the new paneId. `capabilities.handoff` true only when the script exists.
- **C7 Teams**: multi-target prompt (prefix "From the Owner, also sent to: …" when more than one), and the thread feed merging the Project's Agents' transcripts by time; mark an incoming prompt `from` another Agent when the source Agent's last tool call was `herdr agent prompt <target>` / `orcha agent prompt` (best effort; otherwise no `from`). No automatic forwarding ever.
- Tests for every route with the fake Orcha and fake account files under a temp home. Update `docs/orcha-api-gaps.md` if something new is missing.

## Codex (UI), in order

- **K1 Connection popup**: as in plan §4 (bridge unreachable with countdown and Retry, Orcha down with Start Orcha, protocol note once, "Back online" toast; calm: silent). No backend needed.
- **K2 Model dropdown** in the agent header (kind's models + Other…); uses `POST /model`, falling back to sending `/model <name>` through the existing prompt route on 404. Shows "after this turn" when queued.
- **K3 Account picker**: the header fuel block opens a list of accounts of that kind (label, email, plan, fuel, current ticked, Sign in… when not signed in). Choosing one opens the switch dialog: three modes (Keep the conversation = keychain, Fresh sign-in = restart, Hand off), a dry-run `plan` shown before confirming (also-moves list, session not linkable, busy → "Stop and switch now" / "Switch after this turn"), keychain greyed with the reason while `capabilities.accountApi` is false. Also in the rail ⋯ menu and in New Agent / New Project.
- **K4 Settings → Accounts page**: list with kind, label, email, plan, fuel, signed in, panes using it; Sign in works; add/remove/rename/make default shown disabled with "Needs Orcha's account API".
- **K5 Low fuel**: a quiet "Low fuel: hand off?" in the header and rail when `agent.lowFuel`, opening the hand-off dialog (target kind/account, full or summary); after success select the new Agent (the Floor carries it in).
- **K6 Teams**: `@` autocomplete of the Project's Agents in the composer (max 5, chips), sends through `/projects/:ws/prompt`; a "Team" tab next to Chat with the thread feed (portrait + colour per Agent, "Headset → RedCap" for agent→agent, paging up); "Ask a teammate" on Agent messages (pick a teammate, confirm, sends "Please review:" + the message). On the Floor a paper-plane fx from desk to desk when an Agent messages another (calm: none).
- **K7 Art first**: draw `ui/fx-paper-plane.png` (64×16, 4 frames of 16×16, flying right) and `ui/account-badge.png` (64×16, 4 badges of 16×16: claude, codex, cursor, other) in the style of `icons-ui-16.png`; add them to manifest and to `docs/asset-checklist.md` as "Round 9" (Claude approves them). Contact sheet `docs/art-review/r9.png`.
- Screenshots per task in `docs/review/codex-k<n>-*.png` (both themes, 1440×900 and 1024×700 for header/dialog tasks).

## Done when

- Your branch has one commit per task, `bun run check` green, your progress file lists each task and its commit.
- Cursor: every route tested. Codex: the UI works against the contract with the mock fallback and with Cursor's real routes once merged (Claude will merge be/batch1 first, then ask Codex to rebase).
