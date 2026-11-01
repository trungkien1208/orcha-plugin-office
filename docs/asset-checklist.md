# Asset checklist: final batch (Rounds 3–6)

What Codex still has to draw, in one list. It consolidates Rounds 3–5 of [art-brief.md](art-brief.md) plus Round 6 (UI for the floor and the Orcha-style Conversation), with duplicates removed.

Paths are relative to `packages/web/public/office/`. Sizes are the **whole sheet** (frames side by side, left to right). `(redraw)` means the file exists and must be replaced.

Check progress with:

```sh
bun scripts/check-assets.ts          # report
bun scripts/check-assets.ts --write  # also tick the boxes below
```

A box is ticked only when the file exists, has the exact size, and (for a redraw) differs from commit `a26168e`.

## Rules

- Transparent PNG, exact sizes, 1px `#2f3a4f` outline on floor art, palette from art-brief.md only.
- Gold `#ffb020` only on the needs-you marker and the low-fuel HP fill.
- Parts tinted per Project are drawn in greys; on characters they go on the `-polo` layer.
- The office stays **well lit**: one or two flickering tubes, no dark rooms.
- Compound scenery (razor wire, searchlight) is fine. No guards, weapons, blood or real violence; boss gags stay cartoon.
- Every file goes into `manifest.json` (objects / backgrounds / tiles / ui / characters). Add a `layout.animations` entry with frame size and count for each sheet. Keep existing keys.
- Where Round 3 and Round 4 overlap (logo, empty states), use the Round 4 look. `bench-fire` and `bench-ash` follow Round 5.

## A. Carried out and bench on fire (priority 1)

- [x] `characters/bouncer.png` 192×720 (redraw) — 4×10 frames 48×72: walk ↓ ← ↑, reach, grab-left, grab-right, carry-walk ← ↓ ↑, toss, dust-off
- [x] `characters/<worker>.png` 192×792 — every worker sheet and its `-polo` layer gets rows 10–11: lifted, struggle, carried ↓, tossed (spins mid-air)
- [x] `objects/door-open.png` 128×64 — 4×32×64: closed, ajar, open, slammed
- [x] `objects/chair-spin.png` 128×32 — 4×32: empty chair spinning
- [x] `ui/fx-dust.png` 128×32 — 4×32: dust puff when tossed out
- [x] `ui/fx-shoe.png` 16×16 — one shoe left behind
- [x] `ui/marker-out.png` 32×16 — 2×16: "OUT" sign on the door
- [x] `objects/bench-ignite.png` 576×64 — 4×144: sparks catch the bench
- [x] `objects/bench-fire.png` 864×80 (redraw) — 6×144×80: whole bench burning
- [x] `objects/bench-collapse.png` 576×64 — 4×144: bench caves in, monitors drop
- [x] `objects/bench-ash.png` 288×48 (redraw) — 2×144: ash pile, embers blinking
- [x] `ui/fx-smoke-column.png` 192×96 — 4×48
- [x] `ui/fx-embers.png` 96×32 — 3×32
- [x] `objects/fire-alarm.png` 32×16 — 2×16: red alarm light
- [x] `objects/extinguisher.png` 16×32 — wall-mounted
- [x] `ui/tag-burnt.png` 64×16 — scorched team tag

## B. On the floor: selection, HP, team signs (priority 1)

- [x] `ui/hp-bar.png` 32×8 — 9-slice frame of the overhead HP (fuel) bar
- [x] `ui/hp-fill.png` 24×12 — 3 fill strips stacked: green, gold, red (24×4 each)
- [x] `ui/select-marker.png` 32×16 — 2×16: bobbing arrow
- [x] `ui/select-ring.png` 128×24 — 2×64×24: glow ring under the feet
- [x] `ui/name-plate.png` 24×12 — 9-slice plate behind the agent name
- [x] `objects/team-sign-hanging.png` 96×32 — 9-slice hanging team sign with two chains, grey face (tinted per Project)
- [x] `ui/fx-bubble-stage.png` 80×16 — 5×16: thinking, coding, testing, reviewing, finished

## C. Compound scenery and office decor (priority 2)

Outside:

- [x] `background/compound-night.png` 768×224 (redraw) — add razor wire, wall lamps, more lit windows
- [x] `background/compound-night-2.png` 768×224 — lit gate and a van
- [x] `background/compound-dusk.png` 768×224 — dusk version
- [x] `objects/razor-wire.png` 64×16 — wall-top coil, tiles horizontally
- [x] `objects/wall-lamp.png` 32×32 — 2×16×32
- [x] `objects/searchlight.png` 512×64 — 4×128×64: beam sweeping the yard
- [x] `objects/neon-sign.png` 288×32 — 3×96×32: casino neon
- [x] `objects/water-tank.png` 32×48 — rooftop
- [x] `objects/satellite-dish.png` 32×48 — rooftop
- [x] `objects/tangled-cables.png` 32×48 — rooftop

Walls and ceiling:

- [x] `objects/banner-hanging-1.png` 32×96 — red vertical banner
- [x] `objects/banner-hanging-2.png` 32×96
- [x] `objects/banner-hanging-3.png` 32×96
- [x] `objects/banner-wide-2.png` 256×32 — second wall banner
- [x] `objects/poster-kpi.png` 32×48
- [x] `objects/poster-target.png` 32×48
- [x] `objects/poster-team.png` 32×48
- [x] `objects/tv-leaderboard.png` 384×64 — 2×192×64
- [x] `objects/ceiling-light.png` 64×16 — working tube
- [x] `objects/light-pool.png` 96×64 — soft light patch on the floor
- [x] `objects/tube-broken.png` 192×16 — 3×64×16: flickering tube
- [x] `objects/bulb-bare.png` 32×32 — 2×16×32
- [x] `objects/stain-damp.png` 64×32
- [x] `objects/crack-wall.png` 64×32
- [x] `objects/notice-board.png` 64×48 — house rules board

Floor:

- [x] `tiles/floor-wear.png` 32×32
- [x] `tiles/floor-dirty.png` 32×32
- [x] `tiles/floor-cracked.png` 32×32
- [x] `objects/floor-tape.png` 32×8 — walkway line
- [x] `objects/leak-bucket.png` 32×24 — 2×16×24
- [x] `objects/fan-rusty.png` 96×48 — 2×48×48
- [x] `objects/generator.png` 96×48 — 2×48×48
- [x] `objects/extension-mess.png` 32×16

Furniture:

- [x] `objects/locker-row.png` 96×64
- [x] `objects/shrine.png` 64×48 — 2×32×48: lucky-god shrine, red lamp
- [x] `objects/money-counter-table.png` 96×48 — boss office
- [x] `objects/supervisor-podium.png` 48×48
- [x] `objects/turnstile.png` 64×48 — badge gate at the entrance
- [x] `objects/stacked-chairs.png` 32×64
- [x] `objects/water-jugs.png` 32×64
- [x] `objects/printer-big.png` 32×64
- [x] `objects/server-rack.png` 32×64
- [x] `objects/plant-dead.png` 32×48

On the desk:

- [x] `objects/phone-tray.png` 32×16
- [x] `objects/laptop-open.png` 24×16
- [x] `objects/sim-cards.png` 16×16
- [x] `objects/cash-small.png` 16×16
- [x] `objects/snack-pack.png` 16×16
- [x] `objects/ashtray.png` 16×16
- [x] `objects/name-card.png` 16×16
- [x] `objects/battery-lamp.png` 16×16
- [x] `objects/desk-fan.png` 32×24 — 2×16×24

## D. Web UI (priority 3)

- [x] `ui/icons-ui-16.png` 112×96 — 7×6 grid of 16 px icons, order written to `layout.iconsUi.order`: search, settings, bell, sound-on, sound-off, send, attach, close, menu, chevron-left, chevron-right, expand, open-in-orcha, show-on-floor, remove, close-project, new-agent, new-project, filter, rec, tool, pencil, key-enter, key-esc, branch, commit, worktree, file, folder, diff, fuel, tab-chat, tab-changes, tab-files, tab-setup, warning, check, cross, push, pull (2 spare)
- [x] `ui/icons-ui-32.png` 224×192 — same grid at 32 px
- [x] `ui/act-icons.png` 200×20 — 10×20 icons for the Boss popup, one consistent set, left to right: tap (speech bubble), knock (fist), bonk (rolled newspaper), megaphone, buzzer, whip, zap, coffee, high-five, gags (party popper). Replaces the mixed emoji and prop pictures
- [x] `ui/popup-frame.png` 48×48 — 9-slice boss popup frame: plain dark plate, 1px border, hard 3px shadow, no rivets or stripes (the popup is a single slim row)
- [x] `ui/popup-tail.png` 14×8
- [x] `ui/panel-frame.png` 48×48 — 9-slice riveted metal panel
- [x] `ui/panel-header.png` 48×24 — 9-slice dark header with red stripe
- [x] `ui/hazard-tape.png` 32×8 — crisp yellow-black, tiles
- [x] `ui/stamp-urgent.png` 96×32
- [x] `ui/stamp-done.png` 96×32
- [x] `ui/stamp-closed.png` 96×32
- [x] `ui/crt-bezel.png` 64×64 — 9-slice CRT frame for the map card
- [x] `ui/avatar-frame.png` 40×40
- [x] `ui/avatar-frame-needs.png` 40×40 — with warning tape
- [x] `ui/skin-frame.png` 40×40 — skin picker cell in Setup
- [x] `ui/skin-frame-selected.png` 40×40
- [x] `ui/stage-strip.png` 128×32 — Orcha-style THK · COD · TST · END, top row off, bottom row on
- [x] `ui/git-status.png` 64×16 — 4×16 badges: M, A, D, R
- [x] `ui/badge-model.png` 112×16 — 7×16: opus, sonnet, haiku, gpt, codex, cursor, other
- [x] `ui/logo.png` 64×64 — "EASY JOB" stamp badge
- [x] `ui/favicon-32.png` 32×32
- [x] `ui/favicon-needs-32.png` 32×32 — with gold "!"
- [x] `ui/cursor-boss.png` 32×32
- [x] `ui/cursor-hand.png` 32×32
- [x] `ui/empty-inbox.png` 128×96
- [x] `ui/empty-floor.png` 128×96
- [x] `ui/orcha-down.png` 128×96

## Fixes to Round 6 (do these first)

**Review gate (from here to the end):** a file only counts once a human reviewer approves it (`bun scripts/check-assets.ts --approve <path>` records its hash in `docs/art-review/approved.json`). A flat shape, blob, dot, empty frame or plain rectangle of the right size is a placeholder and will be rejected. Match the finish of the Round 6 art (`docs/art-review/round6-*.png`): outlines, shading, readable detail at 1×. Rejected attempts are kept in `docs/art-review/rejected-r7r8/` for reference only.

Keep sizes and frame layouts; the checker wants the file changed since commit 4cf23db.

- [x] `characters/bun.png` 192×792 (redraw since 4cf23db) — frames 26–31 are off-model: 26 (stand, back) and 27 (sit) lost the hair bun and have a stray shadow blob; 28–31 (idle, front) lost the bun and the face is too big. Redraw them to match bun's frames 8 (back) and 13 (front). Every other frame stays byte-identical.
- [x] `characters/bun-polo.png` 192×792 (redraw since 4cf23db) — keep the polo layer in sync with those frames
- [x] `objects/razor-wire.png` 64×16 (redraw since 4cf23db) — reads as a chain; redraw as coiled concertina wire with small barbs, tiling seamlessly left-right
- [x] `characters/bouncer.png` 192×720 (redraw since 4cf23db) — the walk-up and carry-up frames (back view) are flat black silhouettes; add hair, collar, suit seam, arms and a lighter edge so they read on the floor. Front and side frames unchanged.
- [x] `ui/hp-fill.png` 24×12 (redraw since 4cf23db) — the top strip (full fuel) is pale grey; make it a clear green like the gold and red strips

## Round 7 (2026-10-30): icons for the new rail, header and chat; landing page; gate page

Same rules as above. Icons use the `icons-ui` look (16 px grid, 1px dark outline, light fill, one accent), so the web UI can drop every emoji.

### E. Icons for the rail, agent header and chat (priority 1)

- [x] `ui/icons-ui2-16.png` 112×80 — 7×5 grid, order written to `layout.iconsUi2.order`: caret-down, caret-right, more (⋯), copy, stop, resume, jump-latest (arrow to a line), pin, tool-bash (terminal), tool-read (file + eye), tool-edit (file + pencil), tool-write (file + plus), tool-grep (file + magnifier), tool-web (globe), tool-task (sub-agent), tool-todo (checklist), thinking (bubble with dots), clock, heart (HP), bolt (stamina), boss (boss head), image, skill (slash), shell (!), retry, hourglass, lock, crown (rank 1 on the KPI board), theme-office (office tower), theme-compound (fence with razor wire), sun, moon, keyboard (shortcuts), help, spare
- [x] `ui/icons-ui2-32.png` 224×160 — same grid at 32 px
- [x] `ui/spinner-16.png` 128×16 — 8×16: working spinner (rotating pixel arc)
- [x] `ui/thinking-dots.png` 48×16 — 3×16: three dots typing
- [x] `ui/act-icons.png` 200×20 (redraw since 13da905) — new order: tap, knock, hurry (whip crack, motion lines: "work faster"), stop (red octagon hand: interrupt), megaphone, buzzer, zap, coffee, high-five, gags

### F. HP and stamina in the agent header (priority 1)

The 5-hour window is HP (heart, red when low); the weekly window is stamina (bolt, blue).

- [x] `ui/hp-bar-lg.png` 64×12 — 9-slice frame for header bars, chunky game look
- [x] `ui/hp-fill-lg.png` 48×24 — 3 strips of 48×8: green, gold, red, with 1px segment ticks every 6 px
- [x] `ui/stamina-fill-lg.png` 48×8 — blue strip with the same ticks
- [x] `ui/hp-icons.png` 32×16 — 2×16: heart, bolt

### G. Landing page (priority 2)

Pixel art at 1× (the page scales it 2× or 3× with nearest-neighbour). Same compound world, warm and lit, cartoon only.

- [x] `landing/hero.png` 960×360 — cut-away of the office: benches of workers, the Boss with walkie in the aisle, CCTV, banner, compound night through the windows
- [x] `landing/feature-floor.png` 240×160 — the Boss walking the floor, one worker with the gold "needs you" marker
- [x] `landing/feature-chat.png` 240×160 — a worker at a monitor with a chat bubble and a question card
- [x] `landing/feature-hp.png` 240×160 — a worker with HP and stamina bars over the head, coffee cup refill
- [x] `landing/feature-hr.png` 240×160 — two HR bouncers carrying a worker to the door (cartoon)
- [x] `landing/wordmark.png` 320×80 — "EASY JOB" stamp wordmark, red and cream
- [x] `landing/og-image.png` 1200×630 — social card: wordmark over the hero, "Run your AI agents like a compound boss"
- [x] `landing/divider-wire.png` 64×16 — razor-wire section divider, tiles horizontally
- [x] `landing/bg-tile.png` 64×64 — subtle dark tile pattern for page backgrounds, tiles both ways
- [x] `ui/app-icon-192.png` 192×192 — app icon (EJ stamp)
- [x] `ui/app-icon-512.png` 512×512
- [x] `ui/apple-touch-180.png` 180×180

### H. Gate page before entering the compound (priority 2)

Shown while the app connects (token check, Orcha link). States: connecting, approved, denied (bad token), Orcha down.

- [x] `gate/gate-night.png` 640×360 — the compound front gate at night: sign "EASY JOB · HIGH PAY", empty guard booth, floodlights, razor wire, lit office block behind
- [x] `gate/gate-open.png` 768×192 — 4×192×192: the gate leaves sliding open (closed, ajar, half, open)
- [x] `gate/badge-card.png` 160×100 — blank staff pass: portrait slot at left (40×40 at x8,y30), two name lines, barcode, clip hole
- [x] `gate/stamp-approved.png` 128×48 — green "APPROVED" stamp
- [x] `gate/stamp-denied.png` 128×48 — red "DENIED" stamp
- [x] `gate/loading-frame.png` 96×16 — 9-slice progress bar frame
- [x] `gate/loading-fill.png` 16×8 — hazard-stripe fill, tiles horizontally
- [x] `gate/turnstile-anim.png` 256×64 — 4×64: turnstile arm turning as the Boss walks in

## Round 8 (2026-10-30): decoration and a second theme

Two themes the user can switch: **Compound** (today's look) and **Cozy Office** (a calm, modern office with a warm, lo-fi feel: light wood, warm lamps, lots of plants, rugs, a coffee corner, an office cat, big windows with soft sunset or light rain; palette cream, sage green, warm wood, soft blue; no razor wire, no hazard stripes, no fire). Cozy Office files live under `theme-office/` and are listed in `manifest.json` under `themes.office`, mirroring the default keys they replace (for example `themes.office.tiles.floor`), so the code swaps them by key.

### I. Compound decoration (priority 1)

- [x] `ui/header-wire.png` 64×12 — razor-wire strip along the bottom edge of the top bar, tiles horizontally, transparent above and below
- [x] `ui/map-frame.png` 96×96 — 9-slice frame for the Floor card: concrete posts at the corners, razor wire along the top edge, a thin fence mesh on the sides (slices 24/24/24/24)
- [x] `ui/corner-lamp.png` 32×16 — 2×16×16: small caged lamp for the map frame corners, on/off
- [x] `ui/cctv-corners.png` 32×32 — 4 corner brackets (8×8 each in a 2×2 grid at 16 px) for the CCTV look on the map
- [x] `ui/tape-corner.png` 24×24 — a strip of tape for pinning cards and empty states
- [x] `ui/note-paper.png` 48×48 — 9-slice paper note (slightly worn) for tips and empty states
- [x] `ui/clipboard.png` 48×64 — 9-slice clipboard box for the KPI and Setup cards (clip at the top)
- [x] `ui/divider-fence.png` 64×8 — chain-link divider between panels, tiles horizontally
- [x] `ui/sticker-set.png` 192×32 — 6×32: stickers for the corners of panels: "HIGH PAY", "NO PHONES", "KPI", "OVERTIME", "CAM 01", "EMPLOYEE OF THE MONTH"

### J. Cozy Office: Floor art (priority 2)

Same sizes and frames as the Compound files they replace.

- [x] `theme-office/background/city-day.png` 768×224 — calm view out of big windows: low-rise city, trees, soft afternoon light
- [x] `theme-office/background/city-dusk.png` 768×224 — the same at sunset with light rain, warm lit windows
- [x] `theme-office/tiles/floor.png` 32×32 — light oak floorboards
- [x] `theme-office/tiles/aisle.png` 32×32 — woven rug runner
- [x] `theme-office/tiles/wall.png` 96×96 — 9-slice warm cream wall, wood skirting
- [x] `theme-office/objects/window-day.png` 192×48 — 2×96×48: big window, sunset, soft rain streaks
- [x] `theme-office/objects/banner.png` 256×32 — soft fabric pennant banner (blank field kept: code writes the text)
- [x] `theme-office/objects/poster-recruit.png` 48×32 — framed plant print
- [x] `theme-office/objects/door.png` 32×64 — wooden door with a round window
- [x] `theme-office/objects/door-open.png` 128×64 — 4×32×64: wooden door opening
- [x] `theme-office/objects/boss-office.png` 192×96 — manager nook: wood desk, armchair, bookshelf, lamp
- [x] `theme-office/objects/plant.png` 32×48 — leafy plant in a ceramic pot (replaces plant-dead)
- [x] `theme-office/objects/plant-hanging.png` 32×48 — hanging trailing plant
- [x] `theme-office/objects/bookshelf.png` 64×64 — low bookshelf with books, a small plant and a lamp
- [x] `theme-office/objects/whiteboard.png` 96×48 — cork board with sticky notes and photos
- [x] `theme-office/objects/coffee-machine.png` 64×48 — 2×32×48: coffee corner with steaming machine
- [x] `theme-office/objects/desk-lamp.png` 16×24 — warm desk lamp (on every desk)
- [x] `theme-office/objects/rug.png` 128×64 — round woven rug for the aisle and the boss nook
- [x] `theme-office/objects/sofa.png` 96×48 — lounge sofa, soft sage fabric, two cushions
- [x] `theme-office/objects/coffee-table.png` 48×32 — low wood coffee table with a mug and a book
- [x] `theme-office/characters/office-cat.png` 128×96 — 4×32×32 in 3 rows: walk, sit and groom, sleep curled; wanders the floor
- [x] `theme-office/objects/bench-pack.png` 576×64 — 4×144: closing a Project: lamps switch off, a cloth is laid over the desks (replaces the fire)
- [x] `theme-office/objects/boxes.png` 288×48 — 2×144: covered desks with a small "SEE YOU" card, a plant left on top (replaces the ash)
- [x] `theme-office/characters/bouncer.png` 192×720 — friendly HR in cardigans with lanyards, same 40-frame layout as the Compound bouncer; the "carry" rows become walking the worker out arm in arm, the "toss" row a wave goodbye
- [x] `theme-office/ui/tag-closed.png` 64×16 — little wooden "CLOSED" sign for a closed team (replaces tag-burnt)

### K. Cozy Office: UI and pages (priority 2)

- [x] `theme-office/ui/logo.png` 64×64 — soft rounded "EASY JOB" badge, cream and sage
- [x] `theme-office/ui/favicon-32.png` 32×32
- [x] `theme-office/ui/act-icons.png` 200×20 — same order as the Compound strip, gentle versions: tap, knock, hurry (small hand bell), stop (pause hand), megaphone (paper cone), buzzer (desk bell), zap (sparkle), coffee (tea cup), high-five, gags (cookie)
- [x] `theme-office/ui/map-frame.png` 96×96 — 9-slice light wood window frame for the Floor card, a plant on one corner
- [x] `theme-office/ui/header-trim.png` 64×12 — thin trailing-vine strip for the top bar edge, tiles horizontally
- [x] `theme-office/ui/panel-frame.png` 48×48 — 9-slice soft card frame, rounded 4px corners
- [x] `theme-office/ui/sticker-set.png` 192×32 — 6×32: "TEA BREAK", "GOOD VIBES", "FOCUS", "TEAM", "CAM 01" (a little camera with a heart), "EMPLOYEE OF THE MONTH"
- [x] `theme-office/characters/boss.png` 192×720 — the Boss as a friendly manager (cardigan, lanyard, coffee mug instead of the walkie), same 40-frame layout as `characters/boss.png`: whip-crack frames ring a small hand bell, zapper frames wave a sparkle wand, newspaper frames hold up a "pause" card
- [x] `theme-office/characters/boss-portrait.png` 64×64 — matching portrait
- [x] `theme-office/ui/fx-crack.png` 48×16 — 3×16: bell ring lines (replaces the whip crack)
- [x] `theme-office/ui/fx-zap.png` 48×16 — 3×16: soft sparkles (replaces the zap)
- [x] `theme-office/gate/gate-open.png` 768×192 — 4×192×192: glass lobby doors sliding open
- [x] `theme-office/gate/lobby-day.png` 640×360 — the gate page as a calm lobby: reception desk with plants, badge gates, a cat on the counter, warm light

## Round 9 — account and teammate UI (human review required)

- [ ] `ui/fx-paper-plane.png` 64×16 — 4×16×16, flying right; native pixel art, awaiting Claude review
- [ ] `ui/account-badge.png` 64×16 — 4×16×16: claude, codex, cursor, other; native pixel art, awaiting Claude review

## Manifest

- [x] `characters.frame.rows` is 11 and `characters.bouncer.rows` is 10 in `manifest.json`
- [x] every file above is listed in `manifest.json`

## Final sheet sizes

Workers 192×792 (11 rows), boss 192×720 (10 rows), bouncer 192×720 (10 rows).
