# Orcha API gaps

Things Easy Job needed that Orcha's socket API (protocol 22, Orcha 0.9.12) does not offer. We work around each one and do not modify Orcha.

| Gap | Workaround |
|---|---|
| `pane.agent_status_changed` requires a `pane_id`; no wildcard, and one unknown id rejects the whole subscription and closes the connection. | Separate status subscription listing every current pane, rebuilt when panes change; rejection → refresh and retry (ADR 0003). |
| No way to mark an Agent "seen" without `agent.focus`, which moves the user's Orcha view. | Office keeps its own Seen marks per `completion_seq`. |
| `agent.start` needs an existing pane; no "start an agent in this workspace". | `tab.create` (no focus) in the workspace, then `agent.start` on the new pane. |
| No structured conversation history; only terminal text via `agent.read`. | Read the agent's own transcript files (ADR 0001), terminal text as fallback. |
| Codex panes can be reported without `agent_session`, so their rollout file cannot be identified reliably. | Show the visible terminal until Orcha supplies a session ID; never guess from the newest file in the same folder, which may belong to another session. Existing session tracking switches to the transcript when the ID arrives. |
| `agent.read` with `source: recent` can capture an idle Codex alternate screen by sending scroll input. Repeated background reads visibly scroll Orcha. | All terminal fallback reads use `source: visible`; full conversation history comes only from transcript files. |
| No model catalog or structured model/effort/speed setter. | `GET /api/models?kind=…` reads Codex's local model cache, Claude Code's initialization model capabilities, or `agent models` for Cursor. Hidden Codex models are excluded. Model changes use native slash commands; launch uses CLI flags. Effort/Fast are validated per model, Cursor variants retain their advertised IDs, and queued settings are tied to the Agent session. Sending a command is reported as awaiting confirmation, never as an observed model change. |
| The model token can be absent even while a session is running. | `GET /api/agents/:pane/model-state` reads configuration records from that session and, for Codex/Cursor, the footer below that pane's composer using `source: visible`. It never picks a different session by folder or takes a model default from the catalog. Unknown effort/speed remains unknown. The web polls only the selected Agent and shows the observed configuration separately while a change is pending. |
| `agent.send_keys` accepts key combos only (`enter`, `esc`, …), not a free-text Answer. | A free-text Answer uses `pane.send_input` with the text and `keys: ["enter"]`. Key buttons still use `agent.send_keys`. |
| Cursor Agent transcripts are not keyed by Orcha's `agent_session`. `~/.local/share/cursor-agent` is only the CLI. IDE jsonl lives at `~/.cursor/projects/<slug>/agent-transcripts/<chat-uuid>/<chat-uuid>.jsonl` (`{role, message}`). | If that uuid file exists for the session id, Easy Job reads the tail. Otherwise a Cursor Agent shows terminal text from `agent.read`. |
| `orcha plugin link` / `unlink` is not a socket or Herdr command on this build. `orcha plugin` is Claude's plugin marketplace and rewrites its source. | The plugin manifest stays in `integrations/orcha-plugin/`. Do not run `orcha plugin` to install it. The host workspace is still hidden by the `easy_job=bridge` token when Orcha reports it. |

## Accounts (2026-10-31)

Orcha's account features (list with fuel, switch a pane's account, activate, sign in, add, remove) exist only inside its terminal UI (`src/orcha_accounts.rs`); there is no socket method or CLI for them. Easy Job must not touch the Keychain, so switching accounts from the web needs: `account.list`, `account.switch {account_id, pane_id, mode: "keychain" | "restart"}`, `account.activate`, `account.login`, `account.add`, `account.remove`, `account.rename`, and an `account.changed` event. Until then Easy Job reads config.json and the limits cache, and switches only by restarting the agent under the account's own folder. See docs/plan-accounts-team.md.

## Codex session hook reports to the wrong pane (found 2026-11-01)

Codex 0.165+ connects its TUI to a shared app-server daemon (`codex app-server daemon`) and runs hooks inside that
daemon. The daemon keeps the environment of the pane that first started it, so `herdr-agent-state.sh session` sends
`pane.report_agent_session` with that old `HERDR_PANE_ID` (here a closed pane, `agent target … not found`). Codex
agents never get `agent_session`, `transcript_path` or `model`, and clients cannot show their chat.
Easy Job works around it by starting Codex with `--no-daemon` (and `codex resume --last --no-daemon`). Orcha should
do the same in `agent.start`/`agent.handoff` for Codex, or have the hook find its pane another way.

## Plugin updates (for the release plan, `docs/plan-release.md`)

Easy Job must not go online itself, so it needs Orcha to check and apply its updates: `plugin.updates` and
`plugin.update { id }`, advertised in `server.capabilities` with the event `plugin.updates_changed`. Full spec and
the rest of the Orcha work: `docs/orcha-release-prompt.md`.
