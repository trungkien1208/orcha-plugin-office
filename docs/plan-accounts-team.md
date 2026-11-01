# Plan: models and accounts on the web, agents working together, connection popup (2026-10-31)

Five requests from the Owner, checked against Orcha's code (`~/Project/orcha/src/orcha_accounts.rs`) and docs.

## What Orcha has today

- **Accounts** live in `~/.config/orcha/config.json` (`accounts`: id, label, kind, `dir`), with `claude-active`, `claude-slots.json`, `claude-accounts/<id>.json` (cached profile: email, plan) and the fuel cache `~/.cache/orcha/limits/<id>.json`.
- Orcha's terminal UI can list accounts with fuel, **switch** a pane's account, **activate** the default account, **sign in** (`claude auth login` in a new pane) and **add** an account (`~/.ai-accounts/claude/<slug>`, shared history linked in).
- How a Claude switch works: it **rewrites the pane's sign-in in the macOS Keychain** (keeps the replaced one for its owner) and Claude picks it up without a restart. Codex/Cursor: Ctrl+C twice, then `codex resume <session>` (or the agent's resume command).
- None of this is on the socket API or the CLI yet. Easy Job may not touch the Keychain or Orcha's code, so the web needs new Orcha methods for the account work (see "Orcha side").
- **Agents talking to agents** already works inside Orcha panes: with the `herdr` skill installed and `HERDR_ENV=1`, an agent can `agent prompt`, `agent read` and `agent wait` its neighbours by name.

## 1. Change model and account from the web

**Model** (no Orcha change needed):
- Header "model" chip becomes a dropdown: the kind's models (same list as New Agent) plus "Other…".
- Claude and Codex: send the slash command as a prompt (`/model opus`, Codex `/model gpt-5.4`). Only when the Agent is idle (otherwise queue it and say "after this turn"). The header shows the new model once Orcha's snapshot or the transcript reports it.

**Account**:
- Header fuel/HP block becomes an account picker: every account of the Agent's kind with its label, email, plan and fuel (5H and week), the current one ticked, "Sign in…" for an account without a sign-in.
- Choosing one runs a **switch** (see 2 for the two ways). While it runs, the header shows "Switching to Claude · personal…", then the new fuel.
- Also in the rail's agent ⋯ menu ("Switch account") and in New Agent / New Project (pick the account to start on).

## 2. Two ways to switch a Claude account (new; Orcha gets it later)

Ask once per switch (remember the last choice per browser):
1. **Keep the conversation (fast)**: reuse the stored sign-in of the new account (Orcha's Keychain swap). No restart, the chat continues. Needs the Orcha method `account.switch {mode:"keychain"}`; greyed out with a tooltip until Orcha has it.
2. **Fresh sign-in (restart)**: quit Claude in that pane and start it again under the new account's own folder, resuming the same session: Ctrl+C twice, then `CLAUDE_CONFIG_DIR=<account dir> claude --resume <session>` (default account: no variable). If that folder has no sign-in, Claude asks to log in in the pane, and Easy Job shows "Finish signing in in Orcha" with Open in Orcha. Works today through the existing socket (`agent.send_keys` + pane input), for accounts that have a `dir`.
- Codex/Cursor have one way: stop and resume (Orcha's approach), same as 2.
3. **Hand off (last resort)**: start a new Agent on the other account or another kind, seeded with notes from the old conversation (Orcha's `scripts/handoff.py`: full or summary). Use when resume is impossible or the kind should change (out of fuel). Same feature as "Hand off when fuel runs out" in docs/plan-next-features.md.

**Guards for switching** (all modes):
- **Shared folder**: a Keychain swap moves every pane that uses the same config folder (the default `~/.claude` above all). Before switching, list the other Agents on that folder: "This also moves Headset, Robot, Specs", with "Move all" or "Restart only this one instead".
- **Session not in the new folder**: Claude keeps transcripts per config folder. Orcha-made accounts link the shared history; hand-made ones do not. Before a restart-mode switch, check `<new dir>/projects/<slug>/<session>.jsonl`; if missing, link the session file in (never move it); if that fails, offer Hand off.
- **Busy Agent**: restart mode only when idle; when working, ask "Stop and switch now?" or "Switch after this turn" (queued until idle).
- **Expired stored sign-in**: if the Keychain mode fails, say so and offer restart mode (fresh sign-in).

## 3. Agents working together in a Project

Goal: in one Project, the Owner (or an Agent) pulls two other Agents into the same conversation.
- **@mentions in the composer**: typing `@` lists the Project's Agents. `@RedCap @Headset check the API change` sends the prompt to each mentioned Agent (with a one-line header "From the Owner, also sent to RedCap, Headset"). Without mentions the prompt goes to the open Agent as today.
- **Team thread** (new tab next to Chat, per Project): one timeline that interleaves every Agent's messages and the Owner's, newest at the bottom, each message with its Agent's portrait and colour; the composer here always @mentions (defaults to everyone in the Project = today's megaphone).
- **Agent ↔ Agent**: Easy Job installs nothing by itself. Setup shows whether the `herdr` skill is installed for the Agent's kind and offers the one-line install command. When an Agent prompts another through Orcha, the bridge sees it as a prompt on the target pane; the Team thread shows it as "Headset → RedCap" (bridge attributes it when the prompt arrives while the source Agent was running a `herdr agent prompt` tool call; otherwise "from another agent").
- **"Ask a teammate"** button on an Agent message: forwards that message to another Agent with "Please review:" (Owner-confirmed, not automatic).
- On the Floor: a short walk or paper-plane fx from one desk to the other when an Agent messages a teammate (calm mode: none).
- Guardrails: no automatic loops (Easy Job never forwards an Agent's reply on its own), a visible "sent to N agents" receipt, and mention limits (max 5 per prompt).

## 4. Popup when the connection drops

Today only the header dot turns amber. Add a non-blocking popup (top centre, above the chat):
- **Bridge unreachable** (WebSocket closed): "Lost connection to Easy Job. Retrying in 3 s…" with a countdown, Retry now, and after 30 s "Is the bridge running? `easy-job status`". The page greys out and ignores clicks (as today).
- **Orcha down** (bridge up, Orcha not connected): "Orcha isn't running" with Start Orcha (bridge E4 offers it) and the socket path in small text.
- **Protocol warning**: a one-time dismissible note.
- Closes by itself on reconnect with a 2 s "Back online" toast. Never stacks; calm mode: no sound.

## 5. Set up accounts on the web

A Settings → Accounts page:
- List every account (kind, label, email, plan, fuel, sign-in present or not, which panes use it).
- **Add account** (Claude: a name → `claude-<slug>` with its own folder; Codex/Cursor: shown when installed), **Sign in** (opens the sign-in in a new Orcha pane and shows "Finish signing in in Orcha"), **Rename label**, **Remove** (typed confirm; never deletes the folder), **Make default** (Orcha's activate).
- Writes go through Orcha (methods below). Until Orcha has them the page is read-only except "Sign in", which can already run `claude auth login` (with the account's `CLAUDE_CONFIG_DIR`) in a new tab through `tab.create` + pane input.

## Orcha side (the Owner adds these to Orcha later)

New socket methods wrapping the existing functions in `orcha_accounts.rs`, all returning JSON and never a token:
- `account.list {pane_id?, fresh?}` → accounts with label, kind, email, plan, fuel windows, `signed_in`, `active`, and the pane's current account when `pane_id` is given (`accounts_with_fuel`).
- `account.switch {account_id, pane_id, mode: "keychain" | "restart"}` (`switch` / new restart mode).
- `account.activate {account_id}`, `account.login {account_id, pane_id?}`, `account.add {name, kind}`, `account.remove {account_id}`, `account.rename {account_id, label}`.
- An `account.changed` event so the web refreshes without polling.
Record these in `docs/orcha-api-gaps.md`.

## Who does what

- **Cursor (backend)**: bridge routes `/api/accounts` (read config.json + profiles + fuel; later `account.list`), `/api/agents/:pane/model`, `/api/agents/:pane/account` (restart mode now, keychain mode behind an Orcha capability check), `/api/accounts/:id/login` (tab + pane input), multi-target prompt with mentions (`/api/projects/:ws/prompt {to:[paneIds], text}`), Team-thread feed (merge per-Agent transcripts by time, attribute agent→agent prompts), a `capabilities` field in the office state (`accountApi: boolean`). Tests with the fake Orcha (add fake account files under a temp home).
- **Codex (UI)**: model dropdown, account picker with the two switch modes, Settings → Accounts page, @mention autocomplete, Team thread tab, Ask-a-teammate, Floor paper-plane fx, connection popup and toasts. Art if needed: a paper-plane fx (`ui/fx-paper-plane.png` 64×16, 4 frames) and an account avatar badge (`ui/account-badge.png` 64×16, 4 kinds).
- **Owner / Orcha**: the socket methods above.

## Order

1. Connection popup (4) and model switch (1, model part): small, no Orcha change.
2. Account read-only + restart-mode switch + Sign in (1, 2, 5 read-only).
3. @mentions and Team thread (3).
4. When Orcha has the account methods: keychain switch, add/remove/rename/activate on the web.
