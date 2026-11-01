# What Orcha needs for Easy Job to sync well

For the next Orcha version (the Owner's fork). Each item says what is missing today, what Easy Job does instead
(see `orcha-api-gaps.md`), and what it would do once the item lands. Ordered by how much sync quality it buys.

## P0: correctness and speed of the live office

| # | Ask | Today | With it |
|---|---|---|---|
| 1 | **Status events without listing panes**: `events.subscribe` for `pane.agent_status_changed` on all panes (no `pane_id`, or per workspace), and an unknown id should not reject the whole subscription. | A second connection lists every pane and is rebuilt whenever panes change; a pane that closes mid-rebuild drops the subscription. | One subscription for the bridge's lifetime; no missed status changes while panes come and go. |
| 2 | **Many requests on one connection**: answer by `id`, in any order, on a long-lived socket. | Every request opens and closes its own socket (`orcha/client.ts`). | One pooled connection; lower latency on clicks, fewer file descriptors under polling. |
| 3 | **Snapshot deltas**: a `session.changed` event that carries what changed (workspace, pane, agent), or `session.snapshot { since: version }`. | Any lifecycle event triggers a full `session.snapshot` (debounced 150 ms). | Patch in place; the snapshot only on reconnect. |
| 4 | **Session identity for every agent**: `agent_session { kind, id, transcript_path }` for Claude, Codex and Cursor, set as soon as the session starts. | Codex can be reported without a session; Cursor's id does not match its transcript; the bridge searches folders. | Open the exact transcript at once; no "terminal text" fallback for Codex. |
| 5 | **Model, effort and speed in the agent record**, with an event when they change; a setter `agent.configure { model, effort, fast }`. | Read from transcript records and the Codex/Cursor footer by `agent.read` every few seconds; changed by typing slash commands. | No footer scraping or polling; the model pill updates instantly and a change is one call. |
| 6 | **Model catalog**: `agent.models { kind }` with efforts and Fast per model. | Codex's `models_cache.json`, Claude Code init output, `agent models` for Cursor. | One source, same as the terminal. |

## P1: accounts and fuel (blocks the account features)

| # | Ask | Today | With it |
|---|---|---|---|
| 7 | **Account API**: `accounts.list` (id, kind, label, email, plan, signed in, fuel windows, panes), `accounts.switch { pane, account, mode }`, `accounts.login`, `accounts.add/remove/rename/set_default`, and an `accounts.changed` event. | Accounts read from Orcha's config files every 5 s, the pane's account from `ps` env; switching restarts the agent; add/remove/rename disabled. | Keep the conversation on switch; account management in Settings; no `ps` or file polling. |
| 8 | **`agent.start { account_id }`** (and on project create). | New agents start on the default account; switch after start. | Pick the account in New agent. |
| 9 | **Fuel on the socket**: per-account windows with `left` and `reset_at`, pushed when Orcha refreshes them. | Read `~/.cache/orcha/limits/*.json`; the browser polls `/api/fuel` every 30 s. | HP/stamina bars update the moment Orcha knows. |

## P1: actions that should not move the user's Orcha

| # | Ask | Today | With it |
|---|---|---|---|
| 10 | **`agent.start` in a workspace** that creates its own pane without focus and returns the pane id; `workspace.create { cwd, label }` without focus. | `tab.create` + `agent.start` on the new pane. | One call, no half-created tab on failure. |
| 11 | **`agent.mark_seen { pane, completion_seq }`** without focusing. | Easy Job keeps its own Seen marks. | Seen in Easy Job and Orcha agree. |
| 12 | **Scrollback read without input**: `agent.read { source: "scrollback" }` that never sends keys or scrolls. | Only `visible` is safe; `recent` scrolls an idle Codex. | Terminal fallback shows history, not one screen. |
| 13 | **Structured questions**: `agent.question` with the prompt and the option list; `agent.answer { option | text }`. | Options parsed from terminal text; free text through `pane.send_input`. | Question card always matches the terminal, including multi-select. |
| 14 | **Stage in the status event**: thinking / running tool (name) / waiting / done. | Stage guessed from transcript and terminal. | Accurate "working" line and Floor animations. |

## P2: nice to have

| # | Ask |
|---|---|
| 15 | `server.capabilities` listing supported methods and versions, so the bridge feature-detects instead of trying and handling 404. |
| 16 | Hand-off as a socket method (`agent.handoff { pane, to, notes }`) instead of running `handoff.py`. |
| 17 | `orcha plugin link/unlink` for the Easy Job plugin manifest. |
| 18 | A transcript stream (`agent.transcript.subscribe`) so Easy Job does not tail files at all (ADR 0001 would then prefer the socket). |

## Already done on the Easy Job side (2026-10-31)

- Live tool results fold into their call; a multi-byte character split across reads stays whole.
- Session model state is read incrementally from where the last read stopped, not re-parsed from a 2 MB tail.
- The model pill polls every 10 s, every 2 s only while a requested change is pending.
- The snapshot is no longer deep-cloned on every refresh.
