# Cursor backend tasks (2026-10-31)

Codex is wiring the art into `packages/web` at the same time (`docs/codex-ui-tasks.md`). You own the backend. Claude reviews when you are done.

## Rules

- Only edit `packages/bridge/`, `packages/shared/`, `scripts/`, `integrations/`, root config and docs. Do not edit `packages/web/` (Codex owns it); when the web needs a new field, add it to `packages/shared` with a clear doc comment and note it in `docs/PROGRESS.md` so Codex can use it.
- Hand off any frontend work left from the last review (G1–G3 in `docs/codex-ui-tasks.md`, U0) to Codex: do not do it.
- Never modify Orcha; record gaps in `docs/orcha-api-gaps.md`. Local only: bind 127.0.0.1, no telemetry, no outbound requests at runtime.
- Socket code stays in `packages/bridge/src/orcha/transport.ts`.
- One commit per task, Conventional Commits, no push. `bun run check` green after each; every behaviour change has a unit test (fake Orcha in `packages/bridge/test/fake-orcha.ts`).

## E1. Shared fields the new UI needs (`packages/shared`)

- `stageStep(stage?: string): "thinking" | "coding" | "testing" | "reviewing" | "finished" | undefined`: normalise Orcha's stage words (and common synonyms: planning→thinking, editing/writing→coding, running tests→testing, review→reviewing, done/finished→finished). Add `stageStep` to each `Agent` in the reconciler.
- `modelFamily(model?: string, kind?: string): "opus" | "sonnet" | "haiku" | "gpt" | "codex" | "cursor" | "other"` and `modelFamily` on each `Agent`.
- Tests for both with real model and stage strings seen in fixtures.

## E2. Gate support

- Unauthenticated `GET /api/health` returns only `{ bridge: true, orcha: boolean, protocolWarning?: string }`. No names, paths or counts. Same Host/Origin checks as the rest.
- A bad or missing token on HTTP returns `401 { error: "bad_token" }`; on the WebSocket, close with code 4401 and reason `bad_token` (today it may just refuse). Document both in `docs/PLAN.md` (Section 6) so the gate can tell "denied" from "connecting".
- Tests for health and both 401 paths.

## E3. Serve the landing page

- The bridge serves `/landing` and its assets from the web build without a token (static only, no API). Everything else keeps the token rule.
- Security headers on every HTML response: `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Check the app and `/landing` still load (Vite build output) and add a test for the headers.

## E4. Section 7 of `docs/PROGRESS.md`: finish and verify the CLI and packaging

- `easy-job serve | open | stop | status | doctor | autostart | orcha-plugin`: run each, fix what fails, tick the boxes. `autostart` installs/removes a LaunchAgent on macOS only and says so elsewhere.
- Compiled binary: `bun build --compile` of the bridge with the web build embedded or found next to it; `bun run install-local` puts `easy-job` in `~/.local/bin`. Test on this machine and write the exact steps in `README.md`.
- Orcha plugin (`integrations/orcha-plugin/`): the bridge pane is hidden by token, the Start Orcha button works when Orcha is down. Verify against the real Orcha with `scripts/smoke-live.ts` (scratch workspace only, cleans up).

## E5. Section 6 acceptance, automated

Turn the open acceptance items into Playwright checks against `bun run dev:fake` (add them to `e2e/`):
- Stop the bridge → the page shows the amber reconnecting state; start it → live again on the same token without reload.
- Two tabs: only one plays the sound.
- "sent…" clears when the status changes, or says "No change seen yet" after 10 s.
- A rename in the fake Orcha shows up in the page within about a second.

## E6. Transcripts for Codex and Cursor agents

- Add fixtures for a real Codex session and a Cursor agent transcript (scrub paths and text) and make `conversation/codex.ts` / `cursor.ts` parse tools, user and assistant turns like the Claude parser.
- Read the Codex model from its session file when Orcha does not give one, so `model` / `modelFamily` are filled.
- Tests per parser.

## E7. Performance and robustness

- Large transcripts: the first `watch-conversation` sends at most the last 200 items; older ones come through `?before=` paging (the web already asks). Test with a 5 000-line fixture.
- WebSocket backpressure: if a socket's `getBufferedAmount()` stays high, drop conversation deltas for it and send a `reset` once it drains.
- State size: send `state` only when something the UI shows changed (skip identical reconciles; there is a `listen` loop in `http/server.ts`).

## Done when

- `bun run check` and `bun run test:e2e` green.
- `docs/PROGRESS.md` updated: each task with its commit, Section 6 and 7 boxes ticked or a reason written.
- New shared fields listed for Codex under "Requests from Cursor to Codex" in `docs/PROGRESS.md`.
