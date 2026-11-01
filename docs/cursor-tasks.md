# Cursor tasks: connection hardening and a compact small-screen layout (2026-10-31)

From a review of the Orcha link, the conversation tailing and the shell at 820–1366 px. Work top to bottom; each task is small and independent. Claude reviews when you are done.

## Rules

- Never modify Orcha (`~/Project/orcha`). Record a missing Orcha capability in `docs/orcha-api-gaps.md` instead.
- Agent output stays untrusted text; never render it as HTML.
- Keep socket code inside `packages/bridge/src/orcha/transport.ts` (Windows comes later).
- Do not touch art under `packages/web/public/office/` or `docs/asset-checklist.md` (Codex owns those).
- Match the surrounding code style. Every task ends with `bun run check` green (tsc, Biome, `bun test packages`).
- Add a unit test for each bridge change (the fake Orcha in `packages/bridge/test/fake-orcha.ts` and the existing tests show the pattern).
- One commit per task, Conventional Commits, no push.

## A. Connection and conversation (bridge)

### A1. Re-resolve the socket path on every connect attempt
`main.ts` calls `resolveSocketPath(flags)` once. If the bridge starts before Orcha, it settles on the `~/.config/herdr/herdr.sock` fallback and never finds `~/.config/orcha/herdr.sock` when Orcha comes up.
- `startLink({ connect: () => connect(resolveSocketPath(flags)) })`, and keep `socketPath` in the state current (show the path actually used).
- Explicit `--socket` / `EASY_JOB_SOCKET` still win.
- Test: path resolver called again after a failed attempt picks the new socket.

### A2. Status events must not trigger a full snapshot
`readStatus` already patches `agent_status` and emits, then also calls `schedule()`, which takes a full `session.snapshot` for every status change.
- For `pane.agent_status_changed` only patch + emit; still `touch()`. Keep `schedule()` for other events.
- Test with the fake: N status events cause 0 extra `session.snapshot` requests.

### A3. Warn on an unexpected protocol
The snapshot (or `ping`) gives `protocol`; we target 22. When it differs, keep working but put `orcha.protocolWarning` in the office state and show one line in the top bar's live dot tooltip and in `easy-job doctor`.

### A4. Conversation tails follow the agent's session and are released
In `http/server.ts` the `tails` map is keyed by paneId:
- When the agent's `session.value` changes (new session after `/clear` or a restart), close the old watch, locate the new transcript and push the fresh items (send a `conversation` reset; add `reset: true` to the message type in `packages/shared/src/office.ts` and replace the items in the web store when set).
- When the last socket unwatches (or disconnects), close the watcher and delete the tail.
- When the transcript is missing (a brand-new agent writes its file a few seconds later), retry `locateTranscript` every 2 s for up to 60 s while someone watches.
- Tests for all three.

### A5. A safety net for `fs.watch`
`fs.watch` on macOS can miss appends after a rename or an editor-style replace. In `conversation/watch.ts` also `stat` the file every 2 s and read new bytes when the size grew; keep one code path for reading the tail.

### A6. Live terminal fallback
Agents with no transcript show a one-shot `readTerminal`. While watched, poll `readTerminal` every 2 s and push it only when the text changed. Stop when unwatched.

### A7. Clear errors for actions
When an action fails because Orcha is down or slow (`ECONNREFUSED`, `timeout`), return `503 { error: "Orcha isn't answering" }` from the routes instead of a generic 500, and let the web show that text. Test one route.

### A8. Live smoke script against the real Orcha (manual, never in CI)
`scripts/smoke-live.ts`: create a scratch workspace in `/tmp` (focus false), start a `claude` agent in it, send one short prompt, wait for idle, read its conversation through the bridge HTTP API, close the agent and the workspace. Print each step's result. Document how to run it in `README.md`. It must clean up even when a step fails.

## B. Compact layout for small screens (web)

Viewports to check: 1366×768, 1280×800, 1024×700, 820×700. No horizontal page scroll at any of them.

### B1. Slimmer top bar
- Height 44 px at ≤1366 px (logo image 28 px, title text hidden ≤1100 px, keep the word mark otherwise).
- Needs-you button and the ⌘K button keep one line.

### B2. Agent header in two rows max
`packages/web/src/chat/Chat.tsx` (`conv-head`), CSS in `theme.css`:
- Row 1: portrait (32 px at ≤1100 px), name, state pill, and the action buttons on the right (never a row of their own).
- Row 2: HP/stamina bars, then the facts, one line, ellipsis on overflow; the task fact is dropped first.
- Total height ≤ 72 px at 1024 px.

### B3. Compact "Needs you" card
`QuestionCard`: one row: a thin warning strip with the question text (2 lines max, full text in `title`), then the option buttons in a single wrapping row, Enter/Esc/Type as small icon buttons at the end. ≤ 96 px tall for 3 options at 1024 px.

### B4. Context panel collapses below 1280 px
Conversation view (`.convo-card`): below 1280 px hide the right context panel behind a toggle button in the agent header ("Details", icon `diff`/`branch`); the panel opens as an overlay drawer from the right and closes on Esc or outside click. Remember the choice per browser.

### B5. Floor share on small screens
Floor view (`.workspace`): at 1024–1280 px give the Floor 42 % and chat 58 %; at ≤1023 px keep today's Floor toggle. Floor card header and activity footer use one 28 px row each.

### B6. Rail top row at 820 px
The collapse button overlaps the "Floor" button in the rail head. Lay out the rail head so nothing overlaps in either the narrow or wide rail.

### B7. Dense rail rows
Agent rows in `ProjectRail` at ≤1280 px: 28 px portrait, one text line (name · model) plus the task line only when the row is selected; fuel bar 2 px. Target ≤ 44 px per row.

## C. Floor

### C1. HR carries a new Agent in
Today a new worker walks in from the door by itself (`FloorScene.sync`, phase `"entering"` with a route). Make it the mirror of the carry-out in `packages/web/src/floor/Bouncers.ts`:
- Add `bring(worker, done)`: the door opens (`doorOpen` frames 0→2), two bouncers walk in carrying the worker between them (bouncer `carryLeft/carryDown/carryUp` frames 20–31; worker `carriedDown` 40–41 when moving down, else `lifted`/`struggle` 36–39), walk to the desk's approach tile, drop the worker into the chair (worker `sitDown` 27, a small bounce, `fxDust` at the chair), dust off (`dustOff` 36–37), walk back out and fade; the door slams (frames 2→3→0).
- Share the pair limit and queue with `carry()` (at most 2 pairs at once; the rest wait their turn).
- While being carried the worker is not clickable and has no HP bar or selection ring; it becomes `"seated"` when dropped.
- Reduced motion / Calm mode: no carry, the worker appears seated at once (today's behaviour with motion off).
- Cozy Office uses the same code; its HR sheet keeps the same frame layout.
- Only Agents created after the first sync are carried in (not the whole floor on page load).
- Unit-test the queue/limit logic if you extract it; check it by hand on `bun run dev:fake` by starting an Agent from the web.

## Done when

- `bun run check` is green; every bridge task has a test.
- Screenshots at the four viewports (Floor and Conversation) saved under `docs/review/cursor-<viewport>-<view>.png` showing no overlap and no horizontal scroll.
- A short summary in `docs/PROGRESS.md` listing each task and its commit.
