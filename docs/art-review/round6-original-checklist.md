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
- [x] `ui/act-tap.png` 20×20 — boss action (replaces the emoji)
- [x] `ui/act-knock.png` 20×20
- [x] `ui/act-highfive.png` 20×20
- [x] `ui/popup-frame.png` 48×48 — 9-slice boss popup frame
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

## Manifest

- [x] `characters.frame.rows` is 11 and `characters.bouncer.rows` is 10 in `manifest.json`
- [x] every file above is listed in `manifest.json`

## Final sheet sizes

Workers 192×792 (11 rows), boss 192×720 (10 rows), bouncer 192×720 (10 rows).
