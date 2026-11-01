# Easy Job progress

## Review fixes (2026-10-31)

Follow-up on the cursor-tasks work. `bun run check` was green after each fix. Nothing was pushed.

| Fix | Commit | What changed |
|---|---|---|
| F1 | `4bae8c0` | The fake Orcha adds a real pane and an idle agent, then tells the bridge. Carry-in frames are `docs/review/carry-in-01.png` through `carry-in-10.png`. |
| F2 | `769bacf` | A queued carry-in stays hidden until its bouncers place it at the door. |
| F3 | `09483cf` | Removing an Agent mid carry-in cancels that job and frees the slot before the carry-out. |
| F4 | `2a1b9e6` | A conversation tail for a gone Agent sends an empty reset and closes, instead of polling the terminal. |
| F5 | `02c3ac0` | `ENOENT`, `ECONNRESET`, and `EPIPE` return the same 503 as a refused connection. |
| F6 | `5b8cb12` | Header facts no longer overlap. Task, changes, branch, then model drop as the chat narrows. |
| F7 | `b21b9bf` | Enter, Esc, Type, Details, and Floor show a short text label. |
| F8 | `fa98a70` | NEEDS YOU is a short striped tag. The question is one line on a solid background. |
| F9 | `06ea3e2` | Rail wait times are `now`, `3m`, or `1h`, with room reserved so they are not clipped. |
| F10 | `e60d582` | The four viewport screenshots were taken again after these fixes. No horizontal scroll, and the top bar, rail head, and facts did not overlap. |

## Cursor tasks (2026-10-31)

`docs/cursor-tasks.md` A1–A8, B1–B7, and C1. `bun run check` was green after each one (tsc, biome, tests). Nothing was pushed. Orcha, the office art, and `docs/asset-checklist.md` were left alone.

| Task | Commit | What landed |
|---|---|---|
| A1 | `6f56a91` | The socket path is resolved on every connect. The office state shows the path that connected. |
| A2 | `1f5434f` | `pane.agent_status_changed` patches and emits. It no longer takes a `session.snapshot`. |
| A3 | `e514822` | A protocol other than 22 sets `orcha.protocolWarning`. The live-dot tooltip and `easy-job doctor` show that line. The link keeps working. |
| A4 | `7b86416` | A new session resets the conversation. A missing transcript is retried for 60s. The last unwatch closes the watcher. |
| A5 | `c874533` | The transcript tail is also stated every 2s, on the same reader as `fs.watch`. |
| A6 | `777f010` | An Agent with no transcript is polled every 2s. Unwatching stops the poll. The page only gets a push when the text changes. |
| A7 | `d005c19` | `ECONNREFUSED` and a timeout return `503 { error: "Orcha isn't answering" }`. The page already shows that text. |
| A8 | `c3c8a74` | `bun scripts/smoke-live.ts` against a running bridge and a real Orcha. Not part of CI. It cleans up if a step fails. |
| B1 | `148c278` | Top bar is 44px at ≤1366. Logo is 28px. The word mark hides at ≤1100. Needs-you and ⌘K stay on one line. |
| B2 | `49029ae` | Agent header is two rows. At 1024px the header measured 62px. |
| B3 | `e09ded9` | Needs-you card is one row: a two-line question strip, wrapping options, icon buttons for Enter, Esc, and Type. |
| B4 | `500b262` | Below 1280px the context panel is a right-hand drawer. Details toggles it. Esc or an outside click closes it. The choice is remembered. |
| B5 | `8ec0512` | At 1024–1280 the Floor is 42% and the chat 58%. Below 1024 the Floor stays behind its toggle. Header and activity footer are 28px. |
| B6 | `dac7aa7` | The rail head no longer overlaps in the narrow or wide rail. |
| B7 | `75037b1` | At ≤1280, rail rows use a 28px portrait, one text line, the task only when selected, and a 2px fuel bar. |
| C1 | `4d9dbf3` | HR carries a new Agent in, sharing the two-pair queue with the carry-out. Calm mode and the first load still seat them at once. |

Screenshots are in `docs/review/cursor-<viewport>-<view>.png` for 1366×768, 1280×800, 1024×700, and 820×700, Floor and Conversation. At all eight, the page did not scroll horizontally, and the top bar and rail head did not overlap. The top bar was 44px.

C1 was started from the web on `bun run dev:fake`: New Agent → Start Agent closed the dialog with no error. The fake Orcha records the start and does not add the Agent to its snapshot, so the walk-in was not on screen. The pair limit is covered by `packages/web/src/floor/pair-queue.test.ts`.

## Status (2026-10-30, after the merge)

Codex's floor branch (`build/floor`) is merged into `build/orcha-office`. The rest of Cursor's and Codex's work was finished on top of it. `bun run check`: tsc, biome, **49 tests** green.

**Run it:** `bun run install-local`, then `easy-job`. Try actions safely with `bun run dev:fake`.

### Done since the merge

- Floor wired into Home: live state, selection both ways, Done-today, nudge text; work actions call the bridge, gags stay local.
- Layout per the user: Floor is half the screen and fits its height; fixed 768 px world zoomed to the column; camera follows the Boss (no tall page); Bench tags span the Bench; list portraits use the real sprites.
- Walking bug fixed: Bench rows now have a walkway behind the chairs. 24 of 32 Desks were unreachable before, so Agents skipped or cut through furniture. Test: every Desk reachable from the door, no step on a blocked tile.
- HR bouncers carry ended Agents out (max 2 pairs, queue). A closed Project's Bench burns and leaves an ash mark; its tag turns grey; nothing moves. Append-only floor confirmed by Codex's layout test.
- Section 7: `easy-job` CLI (serve/open/stop/status/doctor/autostart/orcha-plugin), `bun run install-local` (launcher in `~/.local/bin`), `integrations/orcha-plugin`, `open --via-orcha`, Start Orcha button.
- Fixed: the host workspace was hidden **by label**, which hid the user's real "Easy Job" Project. It is now hidden by a workspace token only.
- Fixed: the page token was lost on a clean bridge exit. It now lives in `~/.easy-job/token` (0600); open tabs reconnect after a restart.
- Composer has a 📎 attach button.

### Checked in a real browser (fake Orcha)

- Stop the bridge → amber "Reconnecting… data may be out of date", page greyed; start it → live again in the same tab, same token, no reload.
- A Prompt shows "sent…"; a second tab is live too.
- Rename, `/code-review`, `!ls` and an attached file reach Orcha as `agent.rename` / `agent.prompt` (file path appended).
- Floor demo: bouncers carry an Agent out; closing a Project burns its Bench to ash; no page errors.
- Real Orcha (read-only): `easy-job doctor` all green; `easy-job serve` + `status` show 16 Projects / 7 Agents; a second `serve` reuses the bridge; `stop` works.

### Needs the user

- `easy-job orcha-plugin install` and "Open Easy Job" from Orcha's palette (`--via-orcha`): not run, because it registers a plugin and creates a workspace in your real Orcha.
- `easy-job autostart on`: not run (writes a LaunchAgent).
- The same actions once on a throwaway real Agent you start yourself.
- Two-tab sound: leadership is unit-tested; listen once with sound on.
- Quit Orcha and start it again while the page is open.

### Not done (by choice, recorded)

- Compiled binary is `~/.local/bin/easy-job`. The web build sits beside it in `easy-job-web` (not embedded inside the executable).
- Painted floor line linking a Project's `_1` and `_2` Benches.

## Section 5

- [x] 1. Stable agent identity (`agentKey`)
- [x] 2. Skins come from the manifest cast
- [ ] 3. Bench order, team numbers, scorched gap — floor layout, Codex
- [ ] 4. Frame rows from the manifest — floor, Codex
- [x] 5. Question buttons come from the Question text (unit tests + smoke against `dev:fake`)
- [x] 6. Cursor transcripts: parse `~/.cursor/projects/*/agent-transcripts/<uuid>/` when that uuid is the session id; otherwise terminal text. Noted in `docs/orcha-api-gaps.md`
- [x] 7. Transcript tail (~256 KB) and `?before=` paging
- [x] 8. Transcript text is not written to Activity or the bridge log; prompts in Activity are truncated
- [x] 9. Single bridge: `bridge.json` mode `0600`, directory `0700`, reuse a live pid, delete the file on exit
- [x] 10. Protocol banner when `ping` / the snapshot is not protocol 22
- [x] 11. `--no-open`, `--port`, delete uploads older than 7 days
- [x] 12. Fake Orcha and `bun run dev:fake`
- [x] 13. Playwright smoke: token, Project, answer, prompt, new Agent; no token shows the terminal gate
- [x] 14. Sound chip until a click; same sound at most once per 2 seconds
- [x] 15. Done today counted from Activity since local midnight, top 5 on the office state and in the header. The floor's KPI board is Codex
- [x] 16. Persisted seats are `{projectId, benchIndex, seat}` keyed by agentKey. Bench-size memory is not stored. Old files migrate. Drawing the extra Benches is Codex
- [ ] 17. HR bouncer and burning-Bench animations — floor, Codex
- [ ] 18. Walk only on the path grid, with the new props — floor, Codex

## Section 6

- [x] Watchdog snapshot when the socket stays quiet; `dropSocket()` reconnects
- [x] Versioned `hello` + `state`; the page drops an older version
- [x] Heartbeat every 15s; 35s of silence reconnects
- [x] Token reused from `bridge.json`; `--new-token` rotates it
- [x] Conversation `?after=` merges by id
- [x] Waiting times use `serverTime` from `hello`
- [x] Actions show "sent…" and do not invent a status. The marker clears when status changes, or says "No change seen yet" after 10s
- [x] One queue per Agent
- [x] Header dot: green live, amber reconnecting, grey when Orcha is down. Stale pages grey out and ignore clicks
- [x] One tab leads sound and notifications (`BroadcastChannel`)
- [x] Bridge log rotates at 5 MB and does not store transcript text
- [ ] Acceptance in a browser: stop the bridge and see amber, then recover on the same token
- [ ] Acceptance in a browser: two tabs, one sound
- [ ] Acceptance in a browser: "sent…" clears when status changes
- [ ] Acceptance: an Orcha rename shows up within about a second (needs a throwaway Agent, not the user's)

## Section 7

- [x] `easy-job` commands: serve, open, stop, status, doctor, autostart. `orcha-plugin install` was not run: `orcha plugin` rewrites Claude's marketplace and is not Herdr's `plugin link` (docs/orcha-api-gaps.md).
- [x] Compiled binary and `bun run install-local` (`~/.local/bin/easy-job`, web build in `easy-job-web` beside it).
- [x] Hide our own pane (unit test) and Start Orcha (`orcha server` when the binary is on PATH; a clear message when it is not). The button was not used to start a second Orcha while one was already up.

## Browser pass

Against `bun run dev:fake` (Playwright):

- [x] Open with the token, see a Project, answer Headset (buttons from the Question), prompt another Agent, start an Agent
- [x] Without the token, the page says to open Easy Job from the terminal
- [ ] Rename, attach a screenshot, `/skill`, `!ls`
- [ ] The same actions once on a throwaway real Agent

## Backend tasks (2026-10-31)

`docs/cursor-be-tasks.md` E1–E7. Backend only. `packages/web` is left for Codex. `bun run check` green after each. Nothing pushed.

| Task | Commit | What landed |
|---|---|---|
| E1 | `4327c64` | `stageStep` and `modelFamily` on each Agent, from Orcha's stage and model (kind fills a missing model). |
| E2 | `97190b7` | `GET /api/health` is public and tiny. A bad token is `401 { error: "bad_token" }` on HTTP and WebSocket close `4401`. |
| E3 | `fdf392d` | `/landing` and its files are served with no token. HTML responses send the CSP, nosniff, and no-referrer headers. |
| E4 | | `easy-job` serve, open, stop, status, doctor, and autostart on/off ran in a scratch home. The compiled binary is `~/.local/bin/easy-job` with the web build beside it. `orcha plugin link` is not a Herdr command here (see gaps). A scratch Claude stays `launchPending`, so smoke-live cleans up before the prompt. |

## Requests from Cursor to Codex

New optional fields on `Agent` (`packages/shared`):

- `stageStep`: `"thinking" | "coding" | "testing" | "reviewing" | "finished" | undefined`. Set by the reconciler from `stage`.
- `modelFamily`: `"opus" | "sonnet" | "haiku" | "gpt" | "codex" | "cursor" | "other"`. Set by the reconciler from `model`, then `kind`.

## Requests to Cursor

`docs/FLOOR-PROGRESS.md` is not in this tree yet. Nothing requested.

## Codex UI tasks (2026-10-31)

### U0 — review leftovers
Already fixed: G1 `dd6b2d7` (including the never-started queue test), G2 `0e3318d`, G3 `1d4d5df`. Verified the existing fixes rather than reapplying them. `bun run check` green. Task record: `1daf2ba` (`docs: record verified U0 review fixes`). Documentation and requested screenshots are the explicit exceptions to the packages/web-only implementation boundary.

### U1 — Compound Floor
Added exterior/time-of-day selection, wire, lamps, rooftop fixtures, wall posters/banners, television, ceiling lights, floor variants/tape, stable desk clutter and collision-backed side storage. Large furniture is omitted when a side bay cannot hold it; short floors show only storage that fits above the management entrance. No art changed. `bun run check`: 75 tests green, including expanded 640/768/1024-width reachability coverage. Screens: `codex-u1-{compound,office}.png`. Commit: `4b9e3e8` (`feat(web): place Compound floor decoration safely`).
U1 follow-up: the television now mirrors the live KPI ranking, and the supervisor podium sits inside the existing blocked management footprint. Storage items beyond available bays are intentionally omitted rather than covering agents. These limitations remain for follow-up.
Validation note: a subsequent full check was blocked by concurrent backend work (`packages/bridge/test/gate.test.ts`: missing `HTML_CSP`), outside this task's edit boundary. The web/layout check had passed before those backend edits. Continuing as instructed; backend files are not modified here.

### U2 — Cozy Office
Occupied desks get static lamps; Owner portraits follow the theme; dusk/day selection uses local hours (wired in U1). Cat rest targets exclude door and desk approaches, and calm/reduced motion freezes it at frame zero. Existing manifest kpiBoard override already supplies the Office whiteboard. Screens: `codex-u2-{compound,office}.png`. Commit: `f77d17f` (`feat(web): finish Cozy Office desk and character details`). Full check retried; any concurrent bridge failure remains outside the web-only edit boundary.

### U3 — shell sprite integration
Wired panel/portrait frames, HP/stamina atlases, spinning arc, stage strip in header/rail, stage bubbles on the Floor, themed favicon, app icon head links, Floor cursor and Compound divider/hazard assets. Calm/reduced-motion spinner stays on frame zero. U1 side-bay/layout implementation is included in this integration commit because the earlier git index lock prevented those paths from entering its task commit; no history owned by another session was rewritten. Screens: `codex-u3-{compound,office}.png` and `-1024` variants. Commit: `5f0be09` (`feat(web): integrate shell sprites and floor access constraints`).
U3 follow-up: CRT/corner fixtures, done/urgent stamps, skin frames, git/model badges, thinking dots, paper/tape/clipboard/stickers and popup tail are now wired. Closed-project rail stamps remain unused because the live state removes closed projects from the rail. Legacy action/32px duplicates remain compatibility assets where no matching control exists. Full check green. Final screenshot retakes and this integration follow-up ship with U5.

### U4 — landing page
Added a local-font, local-art static landing entry with hero/wordmark, install command, four features, both theme previews, wire dividers and social/app metadata. Responsive at 375px. Vite builds index.html and landing.html; bridge routing remains Cursor-owned. `bun run check`: 81 tests green. Screens: `codex-u4-{compound,office}.png` and `-375` variants. Commit: `7ce6fe1` (`feat(web): add the static Easy Job landing page`).

### Approved asset disposition

Manifest assets are loaded locally; this inventory distinguishes placement references from compatibility-only art. Character sheets/masks/portraits are selected through the manifest skin registry. Storage is capacity-limited and never forced into a walkway.

| Asset | Disposition |
|---|---|
| `office/background/compound-dusk.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/background/compound-night-2.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/background/compound-night.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/characters/beanie-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beanie-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beanie-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beanie.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beard-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beard-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beard-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/beard.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/black-cat-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/black-cat-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/black-cat-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/black-cat.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bob-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bob-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bob-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bob.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/boss-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/boss.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bouncer.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/braids-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/braids-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/braids-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/braids.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bun-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bun-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bun-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/bun.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/capybara-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/capybara-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/capybara-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/capybara.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crew-cut-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crew-cut-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crew-cut-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crew-cut.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crt-bot-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crt-bot-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crt-bot-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/crt-bot.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/curly-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/curly-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/curly-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/curly.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/headset-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/headset-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/headset-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/headset.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/husky-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/husky-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/husky-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/husky.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/mohawk-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/mohawk-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/mohawk-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/mohawk.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/ponytail-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/ponytail-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/ponytail-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/ponytail.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/raccoon-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/raccoon-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/raccoon-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/raccoon.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/red-cap-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/red-cap-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/red-cap-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/red-cap.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/robot-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/robot-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/robot-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/robot.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiba-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiba-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiba-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiba.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiny-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiny-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiny-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/shiny.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/silver-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/silver-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/silver-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/silver.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/specs-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/specs-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/specs-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/specs.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/spike-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/spike-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/spike-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/spike.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/tabby-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/tabby-portrait-polo.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/tabby-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/characters/tabby.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/gate/badge-card.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/gate-night.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/gate-open.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/loading-fill.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/loading-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/stamp-approved.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/stamp-denied.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/gate/turnstile-anim.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/bg-tile.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/divider-wire.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/feature-chat.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/feature-floor.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/feature-hp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/feature-hr.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/hero.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/og-image.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/landing/wordmark.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/ashtray.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/banner-hanging-1.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/banner-hanging-2.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/banner-hanging-3.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/banner-wide-2.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/banner.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/battery-lamp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-ash.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-collapse.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-fire.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-ignite.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-l.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-m.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-r.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-tag-polo.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bench-tag.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/boss-office.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/bulb-bare.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/cash-small.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/cctv.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/ceiling-light.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/chair-back.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/chair-front.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/chair-spin.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/clock.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/crack-wall.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/desk-buzzer.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/desk-fan.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/desk-phone.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/door-open.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/door.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/dorm-block.png` | Unused: dorm intentionally removed. |
| `office/objects/dorm-door.png` | Unused: dorm intentionally removed. |
| `office/objects/drink-crates.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/energy-drink.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/extension-mess.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/extinguisher.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/fan-rusty.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/fire-alarm.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/floor-tape.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/fluorescent.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/generator.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/gong.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/kpi-board.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/laptop-open.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/leak-bucket.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/light-pool.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/locker-row.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/money-counter-table.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/monitor.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/mug.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/name-card.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/neon-sign.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/noodle-boxes.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/noodle-cup.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/notice-board.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/papers.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/phone-chargers.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/phone-rack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/phone-tray.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/plant-dead.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/poster-kpi.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/poster-recruit.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/poster-target.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/poster-team.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/printer-big.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/printer.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/razor-wire.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/satellite-dish.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/searchlight.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/server-rack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/shredder.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/shrine.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/sim-cards.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/snack-pack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/stacked-chairs.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/stain-damp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/supervisor-podium.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/tangled-cables.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/team-sign-hanging.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/tube-broken.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/turnstile.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/tv-leaderboard.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/wall-fan.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/wall-lamp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/water-cooler.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/water-jugs.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/water-tank.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/objects/window-night.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/background/city-day.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/background/city-dusk.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/characters/boss-portrait.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/theme-office/characters/boss.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/theme-office/characters/bouncer.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/theme-office/characters/office-cat.png` | Used through manifest character/portrait registry and theme lookup. |
| `office/theme-office/gate/gate-open.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/gate/lobby-day.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/banner.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/bench-pack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/bookshelf.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/boss-office.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/boxes.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/coffee-machine.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/coffee-table.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/desk-lamp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/door-open.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/door.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/plant-hanging.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/plant.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/poster-recruit.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/rug.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/sofa.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/whiteboard.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/objects/window-day.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/tiles/aisle.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/tiles/floor.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/tiles/wall.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/act-icons.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/bg-paper.png` | Unused: flat text surfaces preserve readability; texture would sit behind shell text. |
| `office/theme-office/ui/favicon-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/fx-crack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/fx-zap.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/header-trim.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/logo.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/map-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/panel-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/sticker-set.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/theme-office/ui/tag-closed.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/aisle.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/floor-cracked.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/floor-dirty.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/floor-wear.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/floor.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/wall.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/tiles/yard.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/act-highfive.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/act-icons.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/act-knock.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/act-tap.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/app-icon-192.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/app-icon-512.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/apple-touch-180.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/avatar-frame-needs.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/avatar-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/badge-model.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/bg-concrete.png` | Unused: flat text surfaces preserve readability; texture would sit behind shell text. |
| `office/ui/bg-metal.png` | Unused: flat text surfaces preserve readability; texture would sit behind shell text. |
| `office/ui/bubble-tail.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/bubble.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/cctv-corners.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/clipboard.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/coffee.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/corner-lamp.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/crt-bezel.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/cursor-boss.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/cursor-hand.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/divider-fence.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/empty-floor.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/empty-inbox.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/favicon-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/favicon-needs-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-bubble-stage.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-crack.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-dust.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-embers.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-heart.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-jolt.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-poof.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-shoe.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-sleep.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-smoke-column.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-smoke.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-stars.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/fx-zap.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/git-status.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hazard-tape.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/header-wire.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hp-bar-lg.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hp-bar.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hp-fill-lg.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hp-fill.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/hp-icons.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-16.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-ui-16.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-ui-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-ui2-16.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/icons-ui2-32.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/logo.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/map-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/marker-needs.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/marker-out.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/megaphone.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/name-plate.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/newspaper.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/note-paper.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/orcha-down.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/panel-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/panel-header.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/popup-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/popup-tail.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/select-marker.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/select-ring.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/skin-frame-selected.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/skin-frame.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/spinner-16.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/stage-strip.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/stamina-fill-lg.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/stamp-closed.png` | Unused: closed projects leave the live rail; no closed rail row is supplied by the current state. |
| `office/ui/stamp-done.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/stamp-urgent.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/sticker-set.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/tag-burnt.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/tape-corner.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/thinking-dots.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/walkie.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/whip.png` | Used by frontend placement, themed lookup, or sprite selection. |
| `office/ui/zapper.png` | Used by frontend placement, themed lookup, or sprite selection. |

### U5 — entry gate and final validation
Added initial connecting/approved/denied/Orcha-down views with theme-resolved scenery and doors, staff pass, Owner portrait, six-character token prefix, progress/turnstile sprites and stamps. Approved plays once then reveals the app; calm/reduced motion skips it. Reconnects after entry retain the existing stale/amber app. Existing Start Orcha confirmation is retained. `/gate.html?state=connecting|approved|denied|down` is a static review harness; production state comes from the store. Commit: HEAD (`feat(web): add themed entry gate and final UI review`).

Screenshots: `codex-u5-{compound,office}.png` plus all four state suffixes. State-suffixed files use the deterministic gate harness; workspace captures use the built app and bridge. U1/U2/U3 screenshots were retaken after discovering the Vite websocket capture could remain on Connecting. U4 also has 375×800 captures; U3 has 1024×700 captures. Final `bun run check`: green, 81 tests including all layout/reachability tests; web production build green. No artwork changed, no push, no Orcha edits or runtime external resources added.

Commit grouping limitation: U1's initial commit contains its review evidence, while pending Floor implementation entered the U3 integration commit after the concurrent git-index lock. Final capture corrections and U3 placement follow-ups are part of U5. Existing concurrent backend commits were neither rewritten nor staged by this run. U0–U5 each have their own task commit, but their file grouping is therefore not perfectly isolated.


## 2026-10-31: UI tidy-up and chat fidelity (Claude)

- Agent header: identity, project · branch, HP over stamina in their own column. Account and model/effort/Fast are
  pills beside a two-line composer, each a popover; one Apply sends one model change. The old header pickers and the
  account dialog for simple switches are gone (the dialog stays for switches that stop work or move other Agents).
- Top bar slimmed; theme, calm, sound, notifications, accounts and Boss lines moved to a Settings page. Sound unlocks
  on the first click anywhere. Floor stats (teams, agents, done today) moved to the Floor header.
- Rail: hover actions, labelled create buttons, no per-row fuel; overflow fixed at 1024.
- Files tab: folder tree with counts and changed marks, folder listings, search, breadcrumbs, line numbers,
  File/Diff, theme colours, images; non-git folders are walked by the bridge.
- New agent / New project rebuilt (`home/Launch.tsx`).
- Chat: turns instead of per-message headers; live tool results fold into their call; UTF-8 split across reads;
  Claude Code wrappers shown like the terminal; Codex context blocks hidden, exit-code based tool status; Cursor
  user queries, tool calls and no 1970 clocks; images from tool results and uploads; clickable paths.
- Bridge: incremental session model reads, slower model polling, no snapshot clone, bounded caches, Seen logged once.
- Orcha asks: `docs/orcha-sync-wishlist.md`.
