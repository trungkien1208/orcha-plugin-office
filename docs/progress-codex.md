# Batch 1 — Codex UI

Worktree: `../PartyAgent-2-ui`, branch `ui/batch1`, base `ad5cbba`. `bun install` completed. No push. The user explicitly directed work to this new worktree; the earlier U5 work remains uncommitted in the original tree and is not included here. This differs from the document's previous-task-committed prerequisite; no original-tree files or history were modified.

## K7 — art first
Native pixel paper-plane animation and four account badges, 64×16 each. Manifest frame layouts and Round 9 checklist entries added. Review sheet: `docs/art-review/r9.png`. Human approval remains pending. Commit: `feat(web): add Round 9 account and paper-plane sprites`.

## K1 — connection popup
Single non-modal notice covers disconnected bridge (actual retry countdown + Retry now, status hint after 30s), Orcha down (Start Orcha + socket path), one-time dismissible protocol note, and 2s recovery toast. No audio. Retrying cancels the pending timer and ignores obsolete socket close callbacks. Foundation contract/HTTP module returns explicit unavailable states on 404. Shared types are not edited. Screens: `codex-k1-{compound,office}-{1440,1024}.png` (mock bridge, Orcha-down state). `bun run check`: 81 tests green. Commit: `feat(web): show connection recovery notices`.

## K2 — model picker
Header model control opens the kind's models plus Other, validates names, blocks question-time changes and shows queued "after this turn" receipts. It never updates reported model optimistically. A 404 falls back to `/prompt` for idle agents; a busy agent gets an explicit unavailable/wait message because the legacy route has no safe queue. 401/409 never trigger fallback. Contract tests cover unavailable/error/busy behavior. Screens: `codex-k2-{compound,office}-{1440,1024}.png`. Full check green. Commit: `feat(web): add guarded model selection`.

## K3 — account picker and switch guards
Fuel block and rail menu open the account list: kind, label, email/plan, fuel, current tick, Sign in and refresh. Switching requires a fresh, matching-mode dry run; stale requests are discarded and successful submissions invalidate the plan. Keychain/handoff respect capabilities; shared folders require Move all consent; missing session links block restart. Busy restart offers queue or explicit interrupt, then rechecks until idle before switching (never forces a rejected plan). Accounts pushes update open lists without shared type edits. Screens include list and busy-plan states in both themes/sizes. Full check green. Commit: `feat(web): add planned account switching`.

Blocked K3 subtask: the specified contract does not add an account ID to either create-Agent or create-Project request/response. Launch fields are present but disabled with an explanation; no ignored account field is sent and no default account is misrepresented as the chosen account. A contract extension is needed to enable them safely. Remaining tasks continue.

## K4 — Settings → Accounts
Account directory shows kind, profile, fuel/reset times, sign-in state and pane names. Sign in returns an Orcha pane with an explicit Open sign-in tab action and refresh instructions. Add/remove/rename/default controls are disabled with the visible explanation "Needs Orcha's account API". Missing routes show unavailable rather than fabricated profiles. Screens: `codex-k4-{compound,office}-{1440,1024}.png`. Full check green (86 tests). Commit: `feat(web): add account settings and sign-in actions`.

## K5 — low fuel and hand off
Quiet header/rail prompts use the contract's lowFuel flag. Confirmed dialog selects target kind/account and full/summary notes, with signed-out accounts disabled. A false/missing handoff capability blocks submission with an explanation. Successful creation waits for the new pane in an actual snapshot before selecting it, so the workspace's missing-agent fallback cannot steal the selection. Original Agent remains intact. No motion/audio added. Screens: `codex-k5-{compound,office}-{1440,1024}.png`. Full check green. Commit: `feat(web): add low-fuel hand-off controls`.

## K6 — teammate collaboration
Composer supports Project-scoped @ autocomplete with keyboard selection, removable chips, max five recipients and preserved recipient drafts across Agent switches. Without recipients it keeps the existing single-Agent send. Team sends use the contract route once, show per-target receipts, and retain only failed recipients plus the draft on partial failure. Team tab merges attributed plain-text messages by time, pages older entries, follows new messages only near the bottom, and defaults to all Agents up to the five-recipient limit. Ask a teammate previews the exact `Please review:` message and requires explicit confirmation; replies are never automatically forwarded.

Floor paper planes come only from new, bridge-attributed thread items; historical pages, self-messages and duplicate polls never trigger them. Calm/reduced motion prevents allocation of a plane and adds no sound. Connection follow-up removes the old duplicate protocol banner/Start action and ignores obsolete socket open/message callbacks. Modal target keys and plan invalidation guard against Agent/account changes during a dialog.

Screens: `codex-k6-{compound,office}-{1440,1024}.png`, plus `-ask` and `-mentions`. All K1–K5 screenshots were retaken against the final UI. Capture fixtures are local contract mocks; no real Agent was switched, interrupted or messaged. Browser contract results are in `docs/review/codex-batch1-check.txt`.

Final validation: `bun run check` green (89 tests, including expanded floor reachability and new API/team guard tests); web production build green. Browser checks cover idle model fallback, account 404, session-link/Keychain guards, capability-blocked hand-off, partial-send retry behavior, draft recipient retention, confirmation before forwarding, inert Agent HTML, Team paging/attribution, recipient cap, 1024px fit and calm no-plane behavior. Real new backend routes cannot be exercised until Cursor's branch is merged; the UI uses the documented contract and graceful 404 fallback. Round 9 remains awaiting human art approval. K3 launch account selection is the only blocked UI subtask, for the contract reason above.

Commit: `ui/batch1` / HEAD (`feat(web): add guarded teammate collaboration`). No push.

## Task commits

| Task | Commit |
|---|---|
| K7 | `2a06a08` |
| K1 | `590f549` |
| K2 | `2dac7f1` |
| K3 | `a11d8a8` |
| K4 | `8c867e3` |
| K5 | `f355175` |
| K6 | `ui/batch1` / HEAD, `feat(web): add guarded teammate collaboration` |

## 2026-11-01 · Office icons and GitHub landing

- Replaced shell sprite/emoji icons with Phosphor Regular, retaining semantic names and theme colours. Boss action menu uses the same family without an app-shell dependency.
- Added the root static `index.html`, generated Cozy Office hero, bundled fonts, current app previews, interactive theme preview and installation command copy.
- Added a deterministic SVG exporter/gallery, a static Pages packager and GitHub Actions workflow. Setup: `docs/landing-and-icons.md`.
- Verified desktop/tablet/mobile, both app themes and calm mode, image loading, clipboard and repository-relative asset paths. Build and `bun run check` pass (141 tests). E2E: 14/16 passed; header height and Agent launch cases require follow-up. New hero is available for human art review; approval registry unchanged.
- No commit, push or deployment.

### Revision · Party Agent / Orcha direction

The owner rejected the scrolling editorial direction. Replaced it with a single-screen welcome + playable Floor and side panel, matching the Party Agent reference's rounded typography, pastel surfaces and native pixel icon language. The generated hero and Phosphor implementation were removed from the final design.

- Root `index.html` now builds the standalone React/Phaser demo through `vite.landing.config.ts`; GitHub Actions installs locked dependencies before building.
- The office uses sample Projects/Agents only. Portrait selection, a sample Answer / Seen action, local Boss callbacks, theme switching, Calm and command copy work without the bridge.
- Native PNG icon references are vendored from the owner's Party Agent project. `pixel-icons.cjs` builds the manifest-backed sprite sheet, index, individual PNGs and light/dark gallery. Shell and Boss controls use this set.
- Public asset loading now respects the entry's repository subpath. Optional `fitOnResize` keeps the demo Floor fitted when the viewport changes; the main app retains its existing zoom behavior.
- Review captures: `docs/review/playable-*.png` and `docs/review/pixel-icons-party-style.png`.

Revision validation: web and standalone builds pass; `bun run check` passes with 141 tests. Browser checks pass at 1440×900, 1024×700 and 390×844: no document scrolling, welcome, live Floor, sample Answer, clipboard, both themes and Calm. A real `/PartyAgent-2/` preview serves the Floor with no missing assets. The local app shows the native pixel icon family. No commit/push/deploy.

### Original direction · Shift Desk

The owner clarified that Party Agent / Orcha were references, not layouts to reproduce. The current landing is an original Shift Desk concept derived from Easy Job's own art and UI: broad Floor, a Project nameplate directory, status jump controls, clipped work tickets and a setup sheet. It opens directly into the office. Chakra Petch / IBM Plex Sans and the existing office/compound colours replace the reference's rounded fonts and pastel page treatment. Removed the unused Fredoka/Nunito dependencies.

Validated: standalone production build; `bun run check` (141 tests); 1440×900, 1024×700 and 390×844 with no document scrolling; Project/status selection; work ticket close/Escape; sample Answer and Seen; native setup dialog, clipboard and Escape; both themes; repository subpath; no missing assets or browser errors. Current captures use `shift-*` filenames. No commit/push/deploy.

### Wide-screen regression reported by owner

The 2560×1283 screenshot exposed a missed layout case: a fixed 640px game world with a capped fit zoom was stretched across an unbounded canvas, leaving a large unpainted region. Capped the page at 1680px and gave the desktop ticket a separate 360px work desk, keeping the canvas within its fitted world width. Enlarged body text, controls and the ticket. Mobile retains a closable ticket overlay; closing a desktop ticket shows a selection prompt.

Added `scripts/check-landing-layout.mjs` to retain the actual regression check. Visual and geometry review covers 2560×1283, 1920×1080, 1440×900, 1024×700 and 390×844; Office/Compound; DPR 1/2; fresh wide load and resize after walking. World coverage is ≥99.4% in all 20 combinations; ticket actions remain visible, canvas sizing matches its host, no document overflow or desktop ticket/canvas overlap. Clipboard/Escape and browser asset/error checks pass. `bun run check`: 141 pass. Screenshots: `wide-fixed-*`.

### Reception + a new main-office composition

The owner explicitly wants both an intro and a creatively redesigned main page. Replaced the prior wide Floor UI with a standalone illustrated office showcase, separate from the production Phaser renderer. The intro is an opening frosted door with an interactive staff pass and Clock in stamp. The main screen combines a complete new office-room illustration, twelve native character sprites, live monitor status, a Conversation note and Project folders. Added matching Cozy Office and Compound room art; the room geometry is identical across themes. On phones, Project controls sit below the room and the Conversation fits below them.

Art paths are generated from `office/manifest.json` into `landing-art.generated.ts` during the build. No approval hashes were written automatically. Removed the obsolete landing-only `fitOnResize` option from the production Floor; its camera behavior is unchanged.

Verification: standalone build and TypeScript pass; `bun run check` passes with 142 tests. Updated `check-landing-layout.mjs` covers fresh intro/main at five sizes from 390×844 to 2560×1283, DPR 1/2, both themes, twelve rendered character canvases and sprite bounds, Answer/Seen, Boss movement, install copy/Escape, and return to reception. No document overflow, missing assets, browser errors or bridge API requests. Current captures: `reception-intro-*`, `boss-office-*`, `boss-compound-*`. No commit, push or deployment.

### 2026-11-01 — Reception entrance and a working office demo

- Added the Easy Chair e/j logo and scaled desktop typography for 27-inch screens (20px Conversation body at 2560px wide).
- Made Clock in a full-width primary action with an explicit Open your office subtitle; the physical door is clickable too. Its hanging CLOSED sign flips to OPEN immediately.
- Added centering/scaling, actual local-asset progress, slow door opening and a main-view fade. Failed loads can retry; reduced motion still waits for assets while skipping animation delays.
- Reused native character sheets, polo compositing, the production status-frame selection and movement advance helper. Corrected chair anchors, including the offset lower Bench. Extracted statusFrame into a pure shared module while preserving its existing export.
- Added staggered Agent conversations, animated typing/screens, and a Boss tour that pauses to check in at Desks. Manual movement takes priority for 12 seconds. Calm freezes the activity. These are local showcase behaviors, not real Orcha messages.
- Validation: landing and production web builds succeeded; `bun run check` passed 145 tests. Added `scripts/check-landing-activity.mjs` for entrance stages, sprite frames, autonomous check-in, Calm/reduced motion and asset failure/retry. Visual review captures are in `docs/review/`.
- Final browser matrix passed all 14 viewport/DPR combinations in both themes (390–2560px), including interactions, readable typography and return/re-entry. No overflow, missing assets, browser errors or bridge requests. Dedicated activity/retry/reduced-motion checks also passed.

### 2026-11-01 — Step through the door; remove the 10 Hz movement bottleneck

- Re-read the owner's Party Agent landing implementation at `agent-fleet/site/office.js`: simulation state and view drawing run separately from UI updates. Kept Easy Job's own composition and assets.
- Replaced the miniature office behind the reception glass with an empty doorway; after opening, the camera scales through the opening before the main view appears. Preserved CLOSED/OPEN, real loading/retry and reduced motion.
- Removed the page-wide React clock and per-frame effects/promises. Sprite sheets are composited once, then cached; only changed frames repaint. Boss movement uses native compositor transform keyframes, while the existing advance helper maintains simulation coordinates and manual control. Hidden tabs cancel the animation loop and pause screens. Removed the room-image filter and reception backdrop blur.
- A six-second local Chromium observation at 2560×1440 DPR2 measured script work at 41.3ms before and 21.3ms after; total task time 200.8ms→181.1ms. Both samples had ~60 browser frames/sec, so the visible defect was 10 Hz Boss positioning rather than measured whole-page frame loss. These are local observations, not a universal performance guarantee. Data: `docs/review/landing-performance.json`.
- `bun run check`: 145 tests pass. The activity browser check covers forward zoom, no preview, smooth transforms, hidden-tab pause, loading failure/retry, Boss check-ins and Calm/reduced motion.
- Final layout/interaction matrix: all 14 viewport/DPR combinations passed in both themes, with no overflow, missing assets, browser errors or bridge requests. Focused source/script lint also passed after the new motion checks were added.

### 2026-11-01 — Reuse the actual Floor and simplify the map

- Removed the landing's generated-room composition, percentage-based seat overlays and separate DOM Boss movement. The landing now extends the actual FloorScene and reuses native benches, chairs, tiles, furniture, characters, keyboard movement, collision layout, pathfinding and Boss actions.
- Added a landing-only fixed camera fitted to the native room bounds. Removed overhead bench signs and redundant status bubbles that obscured the Boss. Kept one You label, the selected seat ring and the needs-you marker; readable team/work information stays in the side panels.
- Added a native desk tour and paper-plane check-ins, with manual input taking priority. Invalid floor clicks stop the old automatic path. Hidden/reception views sleep the Phaser loop. The production Floor implementation and renderer remain unchanged.
- The native art preloader excludes generated landing rooms/gates and decodes with bounded concurrency; the engine is a separate lazy-loaded chunk. Native Canvas rendering at logical 1x avoids DPR-squared allocation. In the same local browser environment, software WebGL dropped frames; Canvas produced 361 frames in six seconds with no intervals above 25ms. This is an environment-specific observation, not a guarantee for every device.
- Native movement test observed 100/100 changing positions along a path and zero blocked cells entered; focused activity checks cover seating, native textures, held-key collision, Calm, hidden tabs, entrance zoom and retry.
- Final Canvas validation: standalone build, source/script lint, and `bun run check` (145 tests) passed. Both themes passed all 14 viewport/DPR combinations with native seating/texture assertions, held-key movement, Answer/Seen, copy/Escape and reception re-entry; no overflow, missing assets, browser errors or bridge requests. The dedicated movement/collision/activity test also passed. Final six-second Canvas sample: 361 browser frames, no intervals above 25ms, p95 16.7ms; see `docs/review/landing-performance.json`.

### 2026-11-01 — An architectural door and the complete four-wall room

- Reworked the reception door into a recessed physical entrance: wall surround/baseboard, thicker frame/jamb, a front face and slab edge, hinges, frosted glazing/reflections, brass handle, lower panel, kick plate, threshold and a cord-hung CLOSED/OPEN plaque. Simplified the brand decal and removed the old sticker. Door/sign motion stays on transforms; there is still no room preview behind the glass.
- The door opens around its hinge, then zooms toward the measured frame center instead of a guessed page percentage. Kept Clock in/loading/retry and reduced motion.
- Per the owner's follow-up, expanded the native office camera to the whole room (640×704): visible back wall and its original fixtures/windows, both side returns, and the front wall with an entrance opening. All wall faces reuse the native wall texture; the existing collision grid and furniture remain unchanged. Added explicit four-side assertions to browser QA.
- Standalone build and `bun run check` passed (145 tests). Native movement/collision/Calm/hidden-tab checks, entrance zoom and asset retry passed. Current review images: `door-material-*` and `office-four-walls-*`.
- Final review: both themes and all 14 viewport/DPR combinations passed with four wall-side assertions, native seating, movement, Answer/Seen, setup and reception re-entry. No overflow, missing assets, browser errors or bridge requests. Focused lint passed. A six-second whole-room browser sample recorded 352 frames (p95 16.7ms); occasional longer frames occurred during concurrent screenshot checks.

### 2026-11-01 — A connected office work surface and a perspective entrance

- Design read: preserve Easy Job's warm paper/rust/olive palette, IBM Plex Sans typography, chair logo and native pixel art. Retire the three isolated columns and the CSS leaf/zoom illusion. Design variance 6, motion intensity 6, visual density 6: a focused office work surface with one purposeful entry sequence.
- Rebuilt the main composition as a larger native Floor beside a compact Projects/Conversation column. The wider 896×704 room retains all four walls and native coordinates. Reused the existing Cozy Office bossOffice desk in the empty quadrant, with matching collision cells. Added a tall-screen Bench roster and retained phone Project controls.
- Added a separate lazy-loaded Three.js reception scene: solid frame/leaf geometry, rounded edges, hinges/hardware, a two-sided CLOSED/OPEN sign, lighting/shadows and a perspective camera that moves through the opening. It contains a plain hall, no office preview. It renders on demand while idle, pauses when hidden, and disposes textures, geometry, shadow maps and its WebGL context on entry. The office remains on the native Phaser Canvas renderer.
- Entry, root hash, theme controls, accessible selection, Answer/Seen, setup/copy and reduced motion remain intact. Browser assertions now inspect actual hinge/camera values rather than just a CSS scale.
- Checked all twelve sample Conversations at seven sizes, including the supplied 2048×1029 view, and adjusted the side column for short screens. Found and corrected a tall-screen roster/footer overlap during screenshot review.

- Delivery validation: standalone landing build, production app build and `bun run check` passed (146 tests). The layout/interaction matrix passed all 16 viewport/DPR combinations in both themes, including the supplied 2048×1029 view. Final focused checks passed after roster spacing, room redraw and keyboard-order adjustments. The reception scene is disposed on entry; movement, collision, hidden-tab pause, Calm/reduced motion and asset retry passed. One earlier concurrent run hit the existing bridge status-event timeout; the final isolated checks passed without backend edits.
- Recorded the delivered entrance at `docs/review/reception-door-motion.webm`; final visual evidence includes `door-real3d-delivery-*` and `office-revamp-delivery-*`. No commit, push or deployment.

## Landing revamp · T1

- Branch: `ui/landing-revamp`, created from `build/orcha-office`; no push. The starting tree already contained an untracked landing implementation, modified manifest, icon work and other edits. Preserved these; saved a starting patch outside the repo. Task commits include landing prerequisites where needed; unrelated changes remain unstaged.
- Read CONTEXT.md, art brief, web guidance and landing code map, then the task brief. Applied the redesign audit to the existing stack; the task's office-paperwork direction takes precedence.
- Consolidated 4,595 lines of accumulated CSS into shared base rules and breakpoint blocks (under 700 lines before readable wrapping). Removed obsolete DOM sprite/room styles, duplicate selectors, superseded values and all `!important`s. CSS Biome: zero errors or warnings.
- Before/after reception and office captures: `docs/review/landing-revamp-before-*` and `landing-revamp-after-t1-*`, 390×844, 1024×700, 1440×900, 2560×1440, Cozy Office and Compound. Static computed-style comparison across the four sizes caught and corrected padding, breakpoint order and fallback-door typography regressions. Native sprite/cat frames can differ between captures because those scenes are live.
- Intentional visual differences: none in T1. Reduced-motion CSS fallback transitions now use scoped selectors instead of `!important`, with the same still result. Existing hidden elements may retain irrelevant inherited differences; visible geometry and type are preserved.

## Landing revamp · T2

- Registered pixel paperwork under `manifest.landing.officePaperwork` and `.compoundPaperwork`: tileable cork, two note variants, push pin, masthead rules, taped staff notice, time card and punch mark. Compound uses independently drawn dark-paper colours, without a filter. Existing note/newspaper/board art provided references; existing character, Bench and UI effect art will supply the live scenes.
- Added 144px and 224px chair derivatives (both <40 KB), chair favicon and apple-touch icon. Existing `ui.favicon32` / `ui.appleTouch180` were inspected: they use the earlier EJ monogram, so they are preserved and landing-specific chair files are provided.
- Social preview: 1200×630 PNG, ~81 KB, current Cozy palette, chair logo and native Floor. `landing.ogImage` now points to it. The 580 KB chair source is retained.
- New art is **pending human approval**. Complete paths, dimensions, byte counts and review hashes: `docs/art-review/landing-revamp.md`. Never ran `--approve`; `approved.json` is untouched. Old landing hero, features, wordmark, divider, background tile and old OG art are retained and listed for the owner there.
- Intentional visual differences: new paperwork objects and social/brand derivatives; no live page changes in T2. The manifest also retains its pre-existing uncommitted brand/icon entries, required by the starting landing implementation.

## Landing revamp · T3

- Replaced the feature-card pitch with The Daily Standup (visitor-local dateline and columns), a cork notice board with five pinned scenes, a taped rules notice and a punch-clock time card. Phone notes and newspaper columns stack; dark-paper assets are selected independently for Compound.
- `Vignette.tsx` renders real character/polo/Boss/bouncer/Bench/effect assets on five small 2D canvases. All character frames and effect sizes come from the generated manifest data. No Phaser or dependency was added for the pitch. IntersectionObserver and visibility listeners stop RAF when offscreen/hidden; Calm and reduced motion draw the first still frame with no plane or stamps. Needs-you hover/click returns the Agent to typing; Seen click switches the Agent to idle. HR carries only the ended sample Agent.
- The shared install component keeps one command source for dialog and time card. Successful Copy punches the visitor's time in each row. Row numbers and punch marks are CSS-generated, so the select-text clipboard fallback contains only commands.
- Intentional visual differences: the entire below-office pitch is now native office paperwork, with selectable newspaper copy, slight pinned-note rotations, real sprite scenes and printed installation rows. Reception, staff pass and playable Floor/Projects/Conversation structure are retained.
- Validation: production landing build passes; `bun run check` passes (155 tests, 0 failures; pre-existing warnings elsewhere remain). Visually inspected the full pitch at 1440px and 390px. Landing CSS has zero Biome warnings. Final interaction/motion and screenshot matrix follows in T5.
- This commit includes the pre-existing, untracked landing adapter/door implementation and its Three.js dependency, plus the standalone pixel-icon/asset-URL prerequisites. Other pre-existing app icon/menu/status edits remain outside the task commits.

## Landing revamp · T4

- Rewrote reception, office heading, Projects binder, Conversation note, setup dialog, metadata and footer copy. Removed all listed slogan pairs/triads, heading eyebrows, coloured full stops and repeated diagonal CTA arrows. Reception now says “Report to the Floor”; the office says “Your shift on the Floor”. The office setup button is a paper-coloured printed control; the staff pass remains the entrance action.
- Kept domain nouns and meanings (Project, Agent, Bench, Desk, Boss, Question/Answer, Needs you, Seen, Nudge, Broadcast and HR bouncers). Removed the obsolete feature-copy array. Printed rules retain local binding/token, no account/telemetry, stop confirmation and Calm facts.
- Preserved the scripted accessible names: Clock in, Return to reception, Yes, run the tests, Looks good. Mark Seen, Copy installation commands and Make it your office.
- Intentional visual differences: shorter plain headings and copy, one-line footer, no spaced-cap heading labels or accent punctuation, quieter setup button. The 3D reception door, pass layout, native Floor and Projects/Conversation arrangement are unchanged.
- Landing build and targeted Biome checks pass. Full checks and the viewport/interaction matrix are run in T5.

## Landing revamp · T5

- Wired manifest-driven chair favicon/apple-touch/social metadata in `index.html`, with OG dimensions and `summary_large_image`. The build emits these relative URLs from the manifest; the UI uses the 144px logo and 224px source set, and the door uses the 224px image. The original chair source is retained.
- Final stylesheet is under 1,000 lines (target <1,800), with shared breakpoint blocks and no `!important`. Targeted landing Biome checks have zero errors/warnings. T1 image comparison is recorded in `docs/review/landing-revamp-t1-comparison.json`: all eight reception pairs are pixel-identical; office differences are confined to live native sprite/cat/effect frames.
- Verification found and fixed a rotated-paper edge overflowing at 1024px and a tablet board rule overriding the phone stack. Added explicit pitch-bound and single-column assertions. Calm checks visit all five canvases and compare real rendered still images. Activity coverage also includes Answer/Seen, successful Copy/punch, blocked-clipboard text selection, hidden-tab/offscreen pause and the existing native Floor/door checks.
- Intentional T5 visual differences: slight safe inset around rotated paperwork; native Bench segments now form one continuous four-Desk Bench with painted monitor screens and chairs; the second HR bouncer is mirrored; the time card uses its native edge/punch art as a border so HTML row rules stay aligned when content wraps. Removed obsolete hidden-element rules/keyframes and the leftover dialog padding from the time card.
- Final verification **passes**: `bun scripts/build-landing.ts`; `bun scripts/preview-landing.ts` (root preview and `/easy-job/` subpath); `bun run check` (155 tests, 0 failures); `node scripts/check-landing-layout.mjs` (all 16 viewport/DPR cases, both themes, pitch bounds and phone stacking); `node scripts/check-landing-activity.mjs` (all five still canvases, Answer/Seen, Copy/punch and selection fallback, motion/visibility and door retry). Subpath verification loads the native Floor, all five vignettes, logos, favicon, touch icon and social-image URLs under `/easy-job/`. Full record: `docs/review/landing-revamp-verification.txt`.
- Final screenshots: reception, office and full pitch at 390×844, 1024×700, 1440×900 and 2560×1440 in both themes; Calm office/pitch at every size (40 matrix PNGs), plus a successful punched time card and activity capture. Review index: `docs/review/landing-revamp.md`. Visually inspected Cozy Office and Compound paperwork, phone stacking, the preserved office column, and the punched time card. The Copy check now waits for the clipboard promise/React render before asserting the timestamp; no product workaround was needed.
- No push. New art remains pending human approval in `docs/art-review/landing-revamp.md`; `approved.json` is untouched. Unrelated starting app/menu/status/guidance changes remain unstaged.

## Claude review follow-up · 1 · rebase and obsolete entry

- Rebased `ui/landing-revamp` onto the current `build/orcha-office` without conflicts. Temporarily stashed and restored the starting tracked/untracked work; unrelated edits remain outside these commits.
- Confirmed the root landing still enters through `src/landing/main.tsx`. Removed the restored, unreferenced `packages/web/src/landing.tsx` and `packages/web/src/landing.css` in this separate commit. The current `src/landing/landing.css` is retained.
- No visual change; no push. No art approval hashes were changed.

## Claude review follow-up · 2 · bundled newspaper serif

- Added `@fontsource/source-serif-4` and bundled just Latin 700 normal (masthead/headline) and Latin 400 italic (signature) through `landing/main.tsx`. Replaced Georgia with Source Serif 4; body copy remains IBM Plex Sans.
- Intentional visual difference: newspaper and signature glyph shapes/line breaks now use a consistent locally served serif across machines. No CDN or runtime external font request.
- Landing build and targeted Biome checks pass. Final browser verification follows item 5.
