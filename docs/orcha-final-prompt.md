You are working in ~/Project/orcha (the Owner's herdr fork), continuing `feat/socket-sync-api`. Goal: finish
everything Easy Job (~/Project/PartyAgent-2, a local web client) needs from Orcha in ONE release, so Easy Job
never has to come back for more. Read first:
- ~/Project/PartyAgent-2/docs/orcha-sync-report.md (live test of protocol 23: what broke, exact lines)
- ~/Project/PartyAgent-2/docs/orcha-sync-wishlist.md and docs/orcha-api-gaps.md (why each item exists)
- ~/Project/PartyAgent-2/integrations/orcha-plugin/herdr-plugin.toml (the Easy Job plugin manifest)
Do not edit anything in PartyAgent-2.

Rules
- Additive and backward compatible: existing methods, params and event shapes keep working.
- Every new method, event and optional behavior is listed in `server.capabilities` (methods / events / features),
  so clients feature-detect. Bump the protocol number once for the whole release (24).
- Every new method/event has a test, an example request/response in socket-api.mdx and a CLI equivalent where it
  makes sense. Never move the user's focus, send keys or scroll as a side effect of a read.
- No secrets over the socket: account methods return profile fields (label, email, plan), never tokens.
- One commit per task, Conventional Commits, no push. Test against a dev server
  (`env -u HERDR_SOCKET_PATH … ORCHA_APP=1 cargo run -- --session orcha-dev server`) with real Claude, Codex and
  Cursor agents. Stop after each batch with a short report, then continue.

## Batch A: fix what the protocol 23 test found
A1. `pane.agent_model_changed` must fire whenever a pane's model changes (it never fired when Claude's model went
    null → claude-opus-5-5; the change only showed in session_changed).
A2. Status events need ordering: add `state_change_seq` (and the current `session_version`) to
    `pane.agent_status_changed` data, and make sure a session_changed record is never older than a status event
    already sent for the same pane.
A3. Docs/payload: a full `session.snapshot` must also expose `session_version` and `session_epoch` at `result`
    level (today they are only inside `result.snapshot`); keep both places, document both.
A4. Cursor's "Do you trust the contents of this directory?" prompt must read as `blocked` (Claude's does).
A5. `agent.prompt` must not report success when the text was only typed: wait for `interactive_ready` (with a
    timeout) or fail with `agent_not_ready`; after a trust prompt the prompt must actually be submitted.
A6. New connections take ~100 ms before the first reply (requests on an open multiplex connection take 10–15 ms).
    Find and remove the accept/handshake delay.

## Batch B: model control
B1. `agent.models { kind }` → models with id, name, efforts, default effort, fast available (per effort if it
    varies), from the same source the CLI uses.
B2. `agent.configure { pane_id, model?, effort?, fast? }` applies all three as one action, queued until idle when
    the agent is busy; the result says `applied` or `queued`; failures are explicit.
B3. Observe effort and fast: agent records must carry real `effort` and `fast` values (from hooks, session
    records or the CLI), not always null, and `pane.agent_model_changed` includes them.

## Batch C: accounts and fuel
C1. `accounts.list` → id, kind, label, email, plan, signed_in, is_default, fuel windows, pane_ids.
C2. `accounts.plan { pane_id, account_id, mode: "keep" | "restart" | "handoff" }` dry run →
    { allowed, reason, also_moves: [pane_ids], needs_idle, session_linked }.
C3. `accounts.switch` with the same params (+ `move_all`, `when_idle`); "keep" swaps the login without restarting
    the conversation when the CLI allows it.
C4. `accounts.login`, `accounts.add`, `accounts.remove`, `accounts.rename`, `accounts.set_default`.
C5. Fuel on the socket: per-account windows { key, label, left_percent, reset_at }, refreshed by Orcha.
C6. `accounts.changed` event (list, sign-in finished, default changed, fuel refreshed).
C7. `agent.start` and workspace creation accept `account_id`.

## Batch D: actions that never move the user, and better agent state
D1. `agent.start { workspace_id, kind, name?, prompt?, account_id?, model?, effort?, fast? }` creates its own pane
    (no focus) and returns the pane id; `workspace.create { cwd, label, focus: false }` returns all new ids.
D2. `agent.mark_seen { pane_id, completion_seq }` without focusing; `seen_seq` on the agent record.
D3. `agent.read { source: "scrollback" }` returns history without sending input or scrolling (today only
    `visible` is safe; `recent` scrolls an idle Codex).
D4. Structured questions: the agent record (or `agent.question { pane_id }`) exposes the question text and the
    options (label, key, multi-select, free text allowed); `agent.answer { pane_id, option | options | text }`.
D5. Stage in status events and agent records: `thinking`, `running_tool` (+ tool name), `waiting`, `done`.
D6. `agent.handoff { pane_id, to: { kind?, account_id? }, notes: "full" | "summary" }` as a socket method
    (replaces running handoff.py), returning the new pane id.
D7. Session identity everywhere: Claude, Codex and Cursor hooks report `agent_session.id`, `transcript_path` and
    `model` at session start (Cursor: the real chat id and its transcript file). Ship the updated hooks in
    `orcha integrations install` and make reinstalling idempotent.

## Batch E: Easy Job as a built-in, opt-in plugin
Easy Job ships as an Orcha plugin (manifest: integrations/orcha-plugin/herdr-plugin.toml in PartyAgent-2: an
"Open Easy Job" action running `easy-job open --via-orcha`, and a `server` pane running `easy-job serve --no-open`).
E1. A real plugin command: `orcha plugin link <dir>`, `orcha plugin unlink <id>`, `orcha plugin list` for
    `herdr-plugin.toml` plugins (today `orcha plugin` is Claude's marketplace and must not be touched). Validate
    `min_herdr_version` and `platforms`.
E2. Socket methods `plugin.list` and `plugin.run_action { plugin_id, action_id }`; plugin actions appear in Orcha's
    command palette / menu.
E3. Plugin panes: start the `server` pane on demand and, when the user opts in, with Orcha ("start with Orcha");
    run it in a hidden or background tab that does not take focus; restart it if it exits; pass
    HERDR_SOCKET_PATH and the pane id, and tag the host workspace/pane (`easy_job=bridge`) so clients can hide it.
E4. Install flow: when Orcha is installed or updated, offer Easy Job as an optional plugin (detect the `easy-job`
    binary or the repo path); nothing is installed or started without consent; uninstall removes it cleanly.
E5. Docs page for plugin authors (manifest fields, actions, panes, env, lifecycle).

## Batch F: optional streams (do if time allows, after A–E)
F1. `agent.transcript.subscribe { pane_id }` streaming new transcript entries (so clients stop tailing files).
F2. `server.capabilities` lists every feature above; `herdr status` shows plugin state.

## Batch G: release
G1. Version bump (minor), protocol 24, CHANGELOG entry listing every new method/event/feature and the hook
    reinstall step.
G2. socket-api.mdx complete for all of the above; a "Clients" section with the recommended sync order
    (capabilities → multiplex → subscribe → snapshot → deltas).
G3. Final report: protocol/version, every method/event with one example request and response, how to try each by
    hand, the hook reinstall command, and anything not done with the reason. Stop the dev server when done.
