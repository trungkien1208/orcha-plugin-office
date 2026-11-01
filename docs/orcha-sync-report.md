# Easy Job against Orcha's sync API (protocol 23): test report

2026-11-01. Orcha `feat/socket-sync-api` (0.9.5, protocol 23) run as a dev server (`--session orcha-dev`), Easy Job
`build/orcha-office` with the new sync path. Real Claude, Codex and Cursor agents in the dev session; every line on
every Easy Job connection was logged with timestamps.

## What Easy Job does now

- `server.capabilities` on connect; the sync path runs only when `server.multiplex`, `session.changed`,
  `events.subscribe.agent_status_all_panes` and `session.snapshot.since` are all present. Older Orchas keep the
  protocol 22 path unchanged.
- One `server.multiplex` connection carries every request, one `session.changed` subscription and one
  `pane.agent_status_changed` + `pane.agent_model_changed` subscription for all panes (replaces ADR 0003's per-pane
  subscription that was rebuilt on every pane change).
- Order: subscribe, `session.snapshot`, then events with `version > session_version`; a jump in `version`, another
  `epoch` or `events_lost` asks for `session.snapshot { since, epoch }`. Reconnects ask for the delta too.
- `agent_session.transcript_path` is opened directly when present; otherwise the old transcript search runs.
  `model` from the agent record wins over the terminal-footer guess.

## What works

| Check | Result |
|---|---|
| Capabilities | protocol 23, all four features listed |
| Multiplex | requests answered by id; ~10–15 ms per request on the open connection |
| All-pane status | every transition seen: claude `unknown → blocked → idle → working → done`, codex `idle → working → done`, cursor `idle` |
| `pane_ids` warnings | `{"type":"subscription_started","warnings":["pane nope:p9 not found; skipped"]}`, not rejected |
| Deltas | workspace add/rename/close, tab and pane add/close, agent records; `since` returns exactly the missed changes |
| Version | +1 per event (an event can carry several changes), so a gap is `version > last + 1` |
| Pane closed mid-subscription | removed from the office with no error and no resubscribe |
| Reconnect | `session.snapshot {"since":41,"epoch":"18e3b24616e72bc8-29d6"}` → `session_delta`, ~0.25 s after the 0.5 s backoff |
| Steady state | 0 requests in 40 s of quiet (no watchdog snapshots, no polling) |
| Session identity | Claude: `id` + `transcript_path` + `model: "claude-opus-5-5"`; Cursor: `id` only; Codex: none (hooks not reinstalled, as expected) |

Same scenario on both paths (prompt, rename, new pane, close pane, 35 s quiet):

| | Protocol 22 path | Sync path |
|---|---|---|
| Connections opened | 10 | 2 |
| Full `session.snapshot` | 5 | 1 (startup) |
| Subscription rebuilds | 3 | 0 |
| Requests while quiet | 1 watchdog snapshot | 0 |
| Event → office updated | debounce 150 ms + new connection + full snapshot | ~5 ms after the event line |

## What breaks or needs Orcha

1. **`pane.agent_model_changed` never fired.** Claude's model went from `null` to `claude-opus-5-5`; the change only
   appeared inside `session_changed` (`{"entity":"pane","id":"wP:p2","op":"updated","record":{… "model":"claude-opus-5-5" …}}`),
   no event line on the `pane.agent_model_changed` subscription.
2. **Status events carry no ordering.** `pane.agent_status_changed` (`working`, 19:06:26.309) was followed by a
   `session_changed` whose agent record still said `idle` (19:06:26.320), then another with `working`. Without a
   `state_change_seq` or `session_version` on the status event a client cannot tell which is newer; Easy Job now
   trusts a status event for 3 s. Ask: put `state_change_seq` (or the version) in the status event data.
3. **Docs vs payload.** A full `session.snapshot` returns `session_version` / `session_epoch` inside
   `result.snapshot`, not at `result` level as the docs show; the delta has them at `result` level.
4. **Cursor trust prompt reads as `idle`.** "Do you trust the contents of this directory? [a] Trust …" is a
   question, but the pane stayed `idle`; Claude's trust prompt correctly reads as `blocked`.
5. **`agent.prompt` right after a trust prompt types but does not submit.** The text stayed in Claude's input and
   the pane stayed `idle` until an extra Enter; the call returned success. It should wait for `interactive_ready`
   or fail with `agent_not_ready`.
6. **Every new connection takes ~100 ms before its first reply** (`server.capabilities` 100 ms, `server.multiplex`
   ack 105 ms), while requests on an open multiplex connection take 10–15 ms. The protocol 22 path pays this on
   every request, so the accept path may be worth a look.

## What still forces polling or scraping

- Effort and Fast are always `null`: Codex/Cursor model state still reads the composer footer (`agent.read`).
- Codex and Cursor have no `transcript_path` until their integrations are reinstalled: transcript search stays.
- Accounts and fuel: still read from Orcha's config and limits files (account API not in this build).
- `agent.configure` and `agent.models` are not available: model changes are still slash commands, and the model
  catalog still comes from each CLI.
