# Easy Job: art brief for Codex

Visual reference (live page with mock screens, palette, status poses and this list):
https://claude.ai/artifact/TEWbKxqqLTdQD36c4BBquz. The same page lives at `docs/style/style-guide.html`.

## What we are drawing

A pixel-art **open-plan call-centre floor**, seen from a top-down three-quarter RPG camera (not isometric), on a 32px tile grid.

- **Mood**: the scam-compound office floors in *No More Bets* (2023) and *Thiên đường máu* (2025). People must recognise it from its props: numbered teams on long benches, phone racks, red slogan banners, a KPI leaderboard, a gong, an "EASY JOB · HIGH PAY" recruitment poster, stacked instant noodles and energy drinks, a dorm door with bunk beds, a boss in a black shirt with a walkie-talkie, cash and a money counter in his glass office, and a compound wall with palm trees and casino neon outside the windows.
- **Floor details from the films**: Long benches of four seats side by side, everyone facing the front wall, a monitor and desk phone at every seat, thin privacy panels between seats, pale grey desks with dark edges, black mesh chairs, grey-teal floor tiles under cold, green-tinted fluorescent light, pale walls with long red slogan banners, a KPI whiteboard, a wall clock, ceiling CCTV domes, and night windows with purple and pink neon outside.
- **Bright and readable inside.** Darkness and neon stay outside the windows.
- **Craft bar**: Party Agent's office (`~/Project/agent-fleet/design/office-style/C/office-preview-v3.png`). Match its detail level, 1px outlines, flat 2-tone shading and readability at 1×.
- **Must look different from Party Agent**: no animals or fantasy characters, no peach floor, no pastel palette, no sofas.
- **Leave out**: bars on windows, guards, weapons, blood, pain. The boss's tools are a walkie-talkie, a megaphone, a rolled newspaper, a desk buzzer, coffee, plus two cartoon gags: a whip he **cracks in the air** above a desk, and a cartoon **zap** (hair stands up, skeleton flash, smoke puff). Pure Looney Tunes slapstick.

## How the floor is used (so the art fits the code)

- One **Bench = 4 seats** side by side, never more. A Project with more than 4 Agents gets a second Bench (`name_1`, `name_2`) in the next free place; Benches never move while the page is open.
- Benches stack in two columns with an aisle between them; the floor grows downward as Projects are added.
- Workers sit with their **backs to the camera**, facing their monitors. The **monitor screen faces the camera** and the code paints the screen colour per status (blue working, gold needs-you, green done, dark idle, grey unknown), so the screen area must be a clean transparent rectangle.
- A small **tag** in front of each Bench shows the Project name (the code writes the text).
- Workers walk in from the door, down the aisle, and sit; they stand up and walk out when they end.

## Rules for every file

- PNG, transparent background, no anti-aliasing, no gradients, no baked drop shadows.
- 1px outline in `#2f3a4f` on every object and character.
- Stay inside the palette below. **Never use gold `#ffb020`** except in `ui/marker-needs.png`: the app reserves it for the "needs you" alert.
- Parts the code tints with a Project colour are drawn in **neutral greys only** (`#d0d0d0` light, `#a0a0a0` mid, `#707070` dark) **on a separate layer file** with the same size and frame layout, so the tint never touches skin or hair: character `-polo` sheets and the bench tag face. They are marked *(tinted)* below.
- Exact pixel sizes as listed. If a sprite is smaller than its box, align it bottom centre.

### Palette

| Role | Hex |
|---|---|
| Outline | `#2f3a4f` |
| Floor / floor alt / grout | `#c9d8d4` / `#bfcfcb` / `#aebdb9` |
| Wall / wall shade / skirting | `#e3ece9` / `#c9d8d4` / `#8fa3a0` |
| Desk / desk edge / privacy panel | `#dfe5e4` / `#9aa8ad` / `#b7c4c8` |
| Chair / chair highlight | `#2a2f38` / `#444b57` |
| Monitor body | `#3b4560` |
| Banner / banner shade / lettering | `#c8322f` / `#9e2522` / `#fff3c4` |
| Night outside / neon | `#1d2747` / `#6a4bd8` `#e0559c` `#3fd2e8` |
| Skin tones | `#f6d2b2` `#f3c9a5` `#e2b089` `#c98f6a` `#8d5a3b` |
| White | `#ffffff` |

## Asset list

Deliver everything under `packages/web/public/office/` with the paths below, plus `manifest.json` (template at the end).

### Characters (default cast of 16: 8 humans + 8 robots and animals, plus extra humans)

| File | Size | Notes |
|---|---|---|
| `characters/<skin>.png` (every skin) | 192×648 | Sheet of 4 columns × 9 rows, each frame 48×72, feet on y=71. Polo *(tinted)*, lanyard + white ID badge. |
| `characters/<skin>-polo.png` (every skin) | 192×648 | Same frames, **only the polo pixels** in greys *(tinted)*; everything else transparent. The base sheet keeps the polo drawn in the same greys. |
| `characters/<skin>-portrait.png` (every skin) | 64×64 | Face and shoulders, facing the camera. |
| `characters/<skin>-portrait-polo.png` (every skin) | 64×64 | Polo layer of the portrait *(tinted)*. |
| `characters/boss.png` | 192×720 | The Observer's character: black shirt, sunglasses, lanyard, walkie-talkie on the belt. Not tinted. Layout in "Boss sheet" below. |
| `characters/boss-portrait.png` | 64×64 | Boss face and shoulders. |

Frame layout (index = row × 4 + column). ↓ faces the camera, ↑ has its back to the camera. Seated frames are drawn behind a chair back: only the upper body needs detail.

| Row | Frames |
|---|---|
| 1 | walk↓ 0–3 |
| 2 | walk← 4–7 (walk→ is mirrored in code) |
| 3 | walk↑ 8–11 |
| 4 | sit↑ 12, stand↓ 13, wave↓ 14, spare 15 |
| 5 | type↑ 16–19 (4-frame typing loop, seen from behind) |
| 6 | hand↑ 20–21 (fully standing, straight legs and both feet visible, one open palm above the head), relax↑ 22–23 (leaning back, stretching) |
| 7 | nap↑ 24–25 (head down on the desk), stand-up 26, sit-down 27 |
| 8 | idle↓ 28–29, spare 30–31 |

Skin ids (keep these exact ids; each must be recognisable from the others at 1×, including from behind, so hair, ears, antennas and tails matter most).

**Default cast** (the 16 the code rotates through):

| id | Kind | Look | Status |
|---|---|---|---|
| `headset` | human | call-centre headset with mic | drawn |
| `red-cap` | human | red baseball cap | drawn |
| `bun` | human | hair in a top bun | drawn |
| `shiny` | human | bald, short beard | drawn |
| `curly` | human | big curly hair | drawn |
| `mohawk` | human | red mohawk | drawn |
| `silver` | human | grey hair, glasses, older | drawn |
| `specs` | human | brown hair, black glasses | drawn |
| `robot` | robot | boxy white robot, screen face with two eyes, antenna | **to draw** |
| `crt-bot` | robot | old beige CRT monitor for a head, cables down the back | **to draw** |
| `shiba` | dog | shiba, pointy ears, curled tail over the chair | **to draw** |
| `husky` | dog | grey and white, fluffy tail | **to draw** |
| `tabby` | cat | orange tabby, striped head, tail hanging down | **to draw** |
| `black-cat` | cat | black, yellow eyes, thin tail | **to draw** |
| `raccoon` | animal | raccoon, bandit eye mask, ringed tail | **to draw** |
| `capybara` | animal | capybara, round brown body, small ears, calm face | **to draw** |

**Extra humans** (already drawn; keep them, they stay selectable in the Skin picker): `crew-cut`, `ponytail`, `beard`, `bob`, `spike`, `braids`, `beanie`.

**Dropped**: `violet` (not drawn; remove it from `manifest.json`).

Old per-skin table, for reference:

| id | Look |
|---|---|
| `crew-cut` | short black hair |
| `specs` | brown hair, black glasses |
| `bun` | hair in a top bun |
| `headset` | call-centre headset with mic |
| `red-cap` | red baseball cap |
| `ponytail` | long brown ponytail |
| `shiny` | bald, short beard |
| `beard` | full beard, dark hair |
| `bob` | blonde bob |
| `spike` | spiky orange hair |
| `curly` | big curly hair |
| `braids` | long braids, glasses |
| `beanie` | blue beanie |
| `silver` | grey hair, glasses, older |
| `mohawk` | red mohawk |


Mix skin tones across the humans. The 8 robots and animals are **office workers, not mascots**: same polo (on its own `-polo` layer), same lanyard and badge, same poses as everyone else, chibi proportions matching the humans' height. They must not look like Party Agent's cozy animal cast: no pastel fur, no hoodies or scarves, no cute props.

### Boss sheet (4 × 10 frames of 48×72)

| Row | Frames |
|---|---|
| 1–3 | walk↓ 0–3, walk← 4–7, walk↑ 8–11 (same as workers) |
| 4 | idle↓ 12–13 (talking into the walkie-talkie), tap-shoulder 14–15 |
| 5 | knock on desk 16–17, press desk buzzer 18–19 |
| 6 | rolled-newspaper bonk 20–22 (wind-up, hit, recover), spare 23 |
| 7 | megaphone shout 24–25, hand over coffee 26–27 |
| 8 | high-five 28–29, arms crossed (watching) 30–31 |
| 9 | whip crack in the air 32–34 (raise, crack, recover), spare 35 |
| 10 | zap gadget 36–37 (hold a straight cartoon electric baton with twin top contacts, no gun shape), spare 38–39 |

The boss sheet is therefore 192×720 (4×10). Workers get one extra row 9 for the zap reaction: `zapped↑ 32–33` (hair on end, skeleton flash frame), so worker sheets become 192×648 (4×9); add the same row to their `-polo` layers.

The worker's reactions to these use existing frames plus two small effect sprites (`ui/fx-stars.png`, `ui/fx-jolt.png`).

### Leaving and closing (added 2026-10-30)

| File | Size | Notes |
|---|---|---|
| `characters/bouncer.png` | 192×360 | HR bouncer: big build, black polo with a white "HR" badge, sunglasses. 4×5 frames of 48×72: walk↓ 0–3, walk← 4–7, walk↑ 8–11, grab 12–13 + 2 spare, carry-walk (arms holding someone) 16–19. Not tinted. Two copies of the same sprite are used, mirrored for the second one. |
| worker sheets: add **row 10** | 192×720 | `carried` 36–37 (lifted under the arms, legs dangling, seen from the side), `tossed` 38 (mid-air, comic), spare 39. Same for every `-polo` layer. Update `characters.frame.rows` to 10. |
| `ui/fx-poof.png` | 96×32 | 3-frame dust cloud (32×32 each) at the door when a worker is tossed out. |
| `objects/bench-fire.png` | 576×64 | 4 frames of 144×64: cartoon flames over a whole 4-seat Bench (orange/yellow, black outline), last frame mostly smoke. |
| `objects/bench-ash.png` | 144×48 | Scorch mark on the floor with a small ash pile and a charred chair leg; stays where the Bench was. |
| `ui/fx-smoke.png` | 96×32 | 3-frame rising smoke puffs. |

Cartoon only: no injuries, no hitting. The bouncers look like club security tossing someone out in an old cartoon. The fire never touches a character.

### Floor and walls

| File | Size | Notes |
|---|---|---|
| `tiles/floor.png` | 32×32 | Seamless grey-teal floor tile, 2 shades so a checker shows. |
| `tiles/wall.png` | 96×96 | 9-slice: front wall band 64 tall (wall, shade, skirting), side walls 16 wide. |
| `tiles/aisle.png` | 32×32 | Dashed aisle marking for the walkway between the two columns. |
| `tiles/yard.png` | 32×32 | Repeatable dark concrete service-yard ground outside the office. |
| `background/compound-night.png` | 768×224 | Solid concrete perimeter, closed sheet-metal gate, dormitory blocks, palms and distant casino neon; no bars or guards. |

### Bench

| File | Size | Notes |
|---|---|---|
| `objects/bench-l.png`, `bench-m.png`, `bench-r.png` | 32×48 each | Long desk in segments: left end, one repeatable seat, right end. Pale grey top, dark front edge, thin privacy panel at the seat edge. No chair, no monitor. |
| `objects/monitor.png` | 32×24 | Monitor facing the camera; **screen area fully transparent** (the code paints it). |
| `objects/chair-back.png`, `chair-front.png` | 32×32 | Black mesh office chair from behind (seated rows) and from the front. |
| `objects/bench-tag.png` | 64×16 | Low tag in front of a bench, face *(tinted)*, blank: the code writes the Project name. |
| `objects/phone-rack.png` | 16×16 | Small stand holding 2–3 smartphones with lit screens; one per seat. |
| `objects/desk-phone.png`, `noodle-cup.png`, `mug.png`, `papers.png`, `energy-drink.png` | 16×16 | Desk clutter. The noodle cup marks Done workers. |
| `objects/desk-buzzer.png` | 16×16 | Big red desk buzzer (the boss's nudge). |

### Front wall

| File | Size | Notes |
|---|---|---|
| `objects/banner.png` | 256×32 | Long red banner with cream pseudo-lettering (no real words). |
| `objects/kpi-board.png` | 96×48 | Whiteboard leaderboard with a red title strip; the code draws the bars. |
| `objects/window-night.png` | 96×48 | Window at night: dark city, purple/pink/cyan neon. 2 frames side by side (192×48) for flicker. |
| `objects/clock.png` | 16×16 | Wall clock. |
| `objects/cctv.png` | 32×16 | Ceiling dome camera, 2 frames of 16×16 (red LED on/off). |
| `objects/door.png`, `water-cooler.png`, `printer.png`, `shredder.png` | 32×64 | Entrance door and wall props. |
| `objects/gong.png` | 64×48 | Gong on a wooden frame; 3 frames side by side (192×48): still, struck, ringing. Struck when an Agent finishes. |
| `objects/poster-recruit.png` | 48×32 | Recruitment poster, red header, blank body: the code writes "EASY JOB · HIGH PAY". |
| `objects/noodle-boxes.png`, `drink-crates.png` | 32×48 | Stacked instant-noodle cartons and energy-drink crates along the walls. |
| `objects/dorm-door.png` | 32×64 | Open side door showing bunk beds inside. |
| `objects/boss-office.png` | 192×96 | Glass-walled office: dark wood desk, leather chair, stacks of cash, a money counter. |
| `objects/fluorescent.png` | 96×16 | Cold white twin-tube industrial ceiling fixture, without a baked glow. |
| `objects/phone-chargers.png` | 48×32 | Dense phone-charging rack with short leads and power-strip switch. |
| `objects/wall-fan.png` | 32×32 | Mechanical wall fan with visible blades and steel cage. |
| `objects/dorm-block.png` | 128×96 | Institutional dormitory annex outside the office, unbarred windows and bunk-bed details. |
| `objects/window-night.png` (update) | 96×48 | Outside: tall concrete compound wall, palm trees, casino neon. 2 frames for flicker. |

### Bubbles and icons

| File | Size | Notes |
|---|---|---|
| `ui/bubble.png` | 24×24 | 9-slice speech bubble, white fill, navy outline. |
| `ui/bubble-tail.png` | 8×6 | Tail for the bubble. |
| `ui/marker-needs.png` | 32×24 | The only gold asset: "!" marker, 2 bounce frames of 16×24. |
| `ui/fx-stars.png`, `ui/fx-jolt.png`, `ui/fx-heart.png` | 48×16 | 3-frame effects (16×16 each): bonk stars, buzzer jolt, coffee heart. |
| `ui/fx-crack.png`, `ui/fx-zap.png` | 48×16 | 3-frame effects: whip-crack burst in the air, cartoon zap sparks + smoke puff. |
| `ui/fx-sleep.png` | 48×24 | Three 16×24 frames of rising `zzz`, drawn as a separate effect above nap frames 24–25. |
| `ui/whip.png`, `ui/zapper.png` | 16×16 | Boss props for the action menu. Zapper is a straight cartoon electric baton with two top contacts, not a gun. |
| `ui/megaphone.png`, `newspaper.png`, `coffee.png`, `walkie.png` | 16×16 | Boss props for menus and effects. |
| `ui/icons-16.png`, `ui/icons-32.png` | grid of 16 / 32 | In this order: `…` `✓` `?` `z` raised-hand, terminal, door, search, sound-on, sound-off, claude, codex, cursor, other-agent. |

## Prompt to start from

```
Pixel art game asset, modern indie quality (1px dark navy #2f3a4f outlines, flat 2-tone shading,
no anti-aliasing, transparent background). Top-down three-quarter RPG camera (not isometric), 32px tile grid.
Setting: a huge open-plan call-centre floor in the mood of the film "No More Bets": long benches of four
seats side by side, everyone facing the front wall, a monitor and desk phone at every seat, thin privacy
panels between seats, pale grey desks with dark edges, black mesh chairs, grey-teal floor tiles under cold
green-tinted fluorescent light, pale walls with long red slogan banners (cream pseudo-text), a KPI
whiteboard, a wall clock, ceiling CCTV domes, night windows with purple and pink neon outside.
Bright and readable inside. No bars, no guards, no weapons.
Scam-compound mood from "No More Bets" and "Thien Duong Mau": numbered teams, phone racks, red slogans, KPI leaderboard, gong,
"EASY JOB · HIGH PAY" poster, noodle cartons, bunk-bed dorm door, boss in black shirt with walkie-talkie,
cash and money counter in a glass office. No bars, guards, weapons or punishment.
Workers are mostly humans, plus a few robots and dogs/cats dressed as the same office workers, chibi-ish proportions, matching polo shirts with a lanyard ID badge,
mostly seen from behind while seated. Draw the polo in neutral greys only so it can be tinted at runtime.
Use only the palette in docs/art-brief.md. Never use gold #ffb020.
```

## manifest.json template

```json
{
  "style": "open-floor-v1",
  "tile": 32,
  "characters": {
    "frame": { "width": 48, "height": 72, "foot": 71, "columns": 4, "rows": 10 }, "bossRows": 10,
    "tinted": true,
    "cast": ["headset", "red-cap", "bun", "shiny", "curly", "mohawk", "silver", "specs", "robot", "crt-bot", "shiba", "husky", "tabby", "black-cat", "raccoon", "capybara"],
    "bouncer": { "sheet": "office/characters/bouncer.png" },
    "boss": { "sheet": "office/characters/boss.png", "portrait": "office/characters/boss-portrait.png" },
    "skins": {
      "crew-cut": { "sheet": "office/characters/crew-cut.png", "polo": "office/characters/crew-cut-polo.png", "portrait": "office/characters/crew-cut-portrait.png", "portraitPolo": "office/characters/crew-cut-portrait-polo.png" }
    }
  },
  "tiles": { "floor": "office/tiles/floor.png", "wall": "office/tiles/wall.png", "aisle": "office/tiles/aisle.png" },
  "objects": {
    "benchL": "office/objects/bench-l.png", "benchM": "office/objects/bench-m.png", "benchR": "office/objects/bench-r.png",
    "monitor": "office/objects/monitor.png", "chairBack": "office/objects/chair-back.png", "chairFront": "office/objects/chair-front.png",
    "benchTag": "office/objects/bench-tag.png", "benchFire": "office/objects/bench-fire.png", "benchAsh": "office/objects/bench-ash.png",
    "banner": "office/objects/banner.png", "kpiBoard": "office/objects/kpi-board.png", "windowNight": "office/objects/window-night.png",
    "clock": "office/objects/clock.png", "cctv": "office/objects/cctv.png", "door": "office/objects/door.png",
    "gong": "office/objects/gong.png", "posterRecruit": "office/objects/poster-recruit.png", "phoneRack": "office/objects/phone-rack.png",
    "deskBuzzer": "office/objects/desk-buzzer.png", "dormDoor": "office/objects/dorm-door.png", "bossOffice": "office/objects/boss-office.png",
    "stacks": ["office/objects/noodle-boxes.png", "office/objects/drink-crates.png"],
    "props": ["office/objects/water-cooler.png", "office/objects/printer.png", "office/objects/shredder.png"],
    "clutter": { "phone": "office/objects/desk-phone.png", "noodle": "office/objects/noodle-cup.png", "mug": "office/objects/mug.png", "papers": "office/objects/papers.png", "drink": "office/objects/energy-drink.png" }
  },
  "ui": { "bubble": "office/ui/bubble.png", "bubbleTail": "office/ui/bubble-tail.png", "markerNeeds": "office/ui/marker-needs.png", "icons16": "office/ui/icons-16.png", "icons32": "office/ui/icons-32.png",
          "fxStars": "office/ui/fx-stars.png", "fxPoof": "office/ui/fx-poof.png", "fxSmoke": "office/ui/fx-smoke.png", "fxCrack": "office/ui/fx-crack.png", "fxZap": "office/ui/fx-zap.png", "whip": "office/ui/whip.png", "zapper": "office/ui/zapper.png", "fxJolt": "office/ui/fx-jolt.png", "fxHeart": "office/ui/fx-heart.png",
          "megaphone": "office/ui/megaphone.png", "newspaper": "office/ui/newspaper.png", "coffee": "office/ui/coffee.png", "walkie": "office/ui/walkie.png" }
}
```

List every drawn skin under `characters.skins`, and add `"cast": [the 16 default ids in the order above]` next to it.

## Done when

- Every file above exists at its exact size, and `manifest.json` lists every one of them.
- No pixel uses `#ffb020` outside `ui/marker-needs.png`; tinted parts contain only greys; the monitor's screen area is fully transparent.
- The 16 default characters are distinguishable from each other at 1×, from the front and from behind; `violet` is gone from the manifest.
- A bench built from `bench-l` + 4 × `bench-m` + `bench-r` (always exactly 4 seats) with chairs and monitors reads as one continuous desk with no seams.

## Round 3: more compound decor (2026-10-30)

The floor and UI now read as the compound, but the room is still sparse. Add these so it feels like a *No More Bets* / *Thiên đường máu* floor. Same rules as above (exact sizes, transparent PNG, 1px `#2f3a4f` outline, palette only, no gold `#ffb020` except the needs marker). Cartoon and office props only: no bars, guards, weapons or punishment.

### Floor and walls

| File | Size | Notes |
|---|---|---|
| `objects/banner-hanging-1.png` … `-3.png` | 32×96 each | Vertical red slogan banners hanging from the ceiling, cream pseudo-lettering, 3 variants. Hung over the aisle. |
| `objects/banner-wide-2.png` | 256×32 | Second long wall banner (different pseudo-text and border). |
| `objects/poster-kpi.png`, `poster-target.png`, `poster-team.png` | 32×48 each | Motivational posters: "100%" target, arrow-up chart, team photo grid. |
| `objects/tv-leaderboard.png` | 96×64 | Wall-mounted TV showing a ranking table; 2 frames (192×64) for a scrolling glow. |
| `objects/ceiling-light.png` | 64×16 | Fluorescent tube panel seen from below, cold white-green; tiled across the floor. |
| `objects/light-pool.png` | 96×64 | Soft cold light patch on the floor under each tube (mostly transparent). |
| `tiles/floor-wear.png` | 32×32 | Scuffed floor tile variant to break the checker. |
| `objects/floor-tape.png` | 32×8 | Yellow-black floor marking strip for walkway edges (not gold: use `#e8c46a`). |

### Desks and clutter

| File | Size | Notes |
|---|---|---|
| `objects/phone-tray.png` | 32×16 | Tray of 6–8 phones with lit screens, for some desks instead of the rack. |
| `objects/laptop-open.png` | 24×16 | Second screen on a desk. |
| `objects/sim-cards.png`, `cash-small.png`, `snack-pack.png`, `ashtray.png`, `name-card.png` | 16×16 | Desk clutter. |
| `objects/desk-fan.png` | 16×24 | 2 frames, spinning. |

### Room props

| File | Size | Notes |
|---|---|---|
| `objects/locker-row.png` | 96×64 | Row of grey staff lockers along a side wall. |
| `objects/shrine.png` | 32×48 | Small fortune shrine with red light and incense (common in these offices); 2 frames (flicker). |
| `objects/money-counter-table.png` | 96×48 | Table with cash stacks and a counting machine for the boss office. |
| `objects/supervisor-podium.png` | 48×48 | Raised supervisor desk with a clipboard, at the front of the floor. |
| `objects/turnstile.png` | 64×48 | ID turnstile at the entry door. |
| `objects/stacked-chairs.png`, `water-jugs.png`, `printer-big.png`, `server-rack.png` | 32×64 | Side props. |
| `objects/plant-dead.png` | 32×48 | Sad office plant. |

### Exterior (above the building)

| File | Size | Notes |
|---|---|---|
| `backgrounds/compound-night-2.png` | 768×224 | Variant of the compound view with a lit gate and a parked van, to swap by time. |
| `backgrounds/compound-dusk.png` | 768×224 | Same view at dusk (warmer sky), for daytime hours. |
| `objects/neon-sign.png` | 96×32 | Casino neon sign on the far building, 3 frames of flicker (288×32). |

### UI art for the web shell

| File | Size | Notes |
|---|---|---|
| `ui/logo.png` | 64×64 | "EASY JOB" badge: red stamp style, for the header and favicon. |
| `ui/empty-inbox.png` | 128×96 | A worker asleep on the desk: "Nobody needs you". |
| `ui/empty-floor.png` | 128×96 | The Boss with a megaphone in an empty room: "No agents yet". |
| `ui/orcha-down.png` | 128×96 | Lights off over the floor: "Orcha isn't running". |
| `ui/badge-model.png` | 112×16 | 7 small model badges in one strip: opus, sonnet, haiku, gpt, codex, cursor, other. |

Add every file to `manifest.json` (new keys under `objects`, `backgrounds`, `ui`) and run the "Done when" checks.

## Round 4: low power and the compound UI (2026-10-30)

The shell is a dark compound "surveillance room": dark panels, phosphor text, scanlines, hazard tape. **The office itself stays well lit** (user, 2026-10-30): mostly working fluorescent tubes, only one or two flickering; power-cut props are small accents, not the mood. CSS already does the colours, scanlines, flicker and hazard stripes. These are the parts CSS cannot draw well. Same rules as before (exact sizes, transparent PNG, 1px `#2f3a4f` outline on floor art, palette only, gold only on the needs marker). Scenery may show the compound's fences; still no guards, weapons or violence.

### Exterior and compound edge (above the building)

| File | Size | Notes |
|---|---|---|
| `backgrounds/compound-night.png` (redraw) | 768×224 | Same brightness as now; add razor wire, wall lamps and more lit windows, casino neon in the distance. |
| `objects/razor-wire.png` | 64×16 | Coiled razor wire along the top of the compound wall; tiles horizontally. |
| `objects/wall-lamp.png` | 16×32 | Weak yellowish security lamp on the wall, 2 frames (flicker). |
| `objects/searchlight.png` | 128×64 | Faint searchlight cone sweeping the yard, 4 frames, mostly transparent. |
| `objects/water-tank.png`, `satellite-dish.png`, `tangled-cables.png` | 32×48 | Rooftop clutter on the compound buildings. |

### Low-power office floor

| File | Size | Notes |
|---|---|---|
| `objects/tube-broken.png` | 64×16 | Fluorescent tube with one dead end, 3 frames (on / dim / off) for flicker. |
| `objects/bulb-bare.png` | 16×32 | Bare bulb hanging on a wire, 2 frames (glow / dim). |
| `objects/light-cone.png` | 96×96 | Soft cold light pool cast by a tube; the code draws darkness everywhere else. |
| `objects/generator.png` | 48×48 | Small diesel generator with a fuel can, 2 frames (vibrating). |
| `objects/extension-mess.png` | 32×16 | Daisy-chained power strips and cables on the floor. |
| `objects/battery-lamp.png` | 16×16 | Desk battery lamp for dark Benches. |
| `objects/stain-damp.png`, `crack-wall.png` | 64×32 | Damp stain and cracked plaster decals for the front wall. |
| `objects/leak-bucket.png` | 16×24 | Bucket under a ceiling drip, 2 frames (drop). |
| `objects/fan-rusty.png` | 48×48 | Replaces the wall fan: rusty, 2 frames. |
| `tiles/floor-dirty.png`, `tiles/floor-cracked.png` | 32×32 | Floor variants mixed in by hash. |
| `objects/notice-board.png` | 64×48 | Board with pinned rules and shift lists (pseudo-text). |

### UI pieces for the web shell (pixel art, used as images or 9-slices)

| File | Size | Notes |
|---|---|---|
| `ui/panel-frame.png` | 48×48 | 9-slice riveted metal frame (16 px corners) for card edges. |
| `ui/panel-header.png` | 48×24 | 9-slice dark metal strip with a red stripe for card headers. |
| `ui/hazard-tape.png` | 32×8 | Seamless gold/black tape strip (sharper than the CSS one) for the needs-you bar. |
| `ui/stamp-urgent.png`, `ui/stamp-done.png`, `ui/stamp-closed.png` | 96×32 | Red rubber-stamp labels ("URGENT", "DONE", "CLOSED") at an angle. |
| `ui/crt-bezel.png` | 64×64 | 9-slice CRT monitor bezel for the Floor card. |
| `ui/icons-ui-16.png`, `ui/icons-ui-32.png` | 16/32 grid | Shell icons in the same style: search, settings, bell, sound on/off, send, attach, close, menu (⋯), chevrons ◂ ▸, expand, open-in-orcha, remove, close-project, new-agent, filter, rec dot. Order documented in the manifest `layout.iconsUi.order`. |
| `ui/logo.png` | 64×64 | "EASY JOB" badge, red stencil stamp style (also the favicon). |
| `ui/cursor-boss.png`, `ui/cursor-hand.png` | 32×32 | Custom cursors over the Floor. |
| `ui/empty-inbox.png`, `ui/empty-floor.png`, `ui/orcha-down.png` | 128×96 | Empty-state pictures (asleep at the desk; Boss with megaphone in an empty room; lights out over the floor). |
| `ui/avatar-frame.png` | 40×40 | 9-slice frame for portraits (scratched metal), plus `avatar-frame-needs.png` with hazard tape. |

Add every file to `manifest.json` (keys under `objects`, `backgrounds`, `tiles`, `ui`, and `layout.iconsUi`), keep existing keys, and run the "Done when" checks.

## Round 5: "carried out" and "bench on fire" animations (2026-10-30)

Both scenes work in code today with stand-in frames, so they look temporary. These sheets make them read as real animations. Frames are 48×72 for characters (feet on y=71) unless noted; sheets are horizontal strips or 4-column grids as listed. Cartoon slapstick only: nobody is hurt, the fire never touches a character.

### Carried out by the HR bouncers

| File | Size | Frames | Notes |
|---|---|---|---|
| `characters/bouncer.png` (redraw) | 192×720 | 4×10 | Rows: walk↓, walk←, walk↑ (4 each); **reach** (2, arms forward); **grab-left** / **grab-right** (2 each, hands at armpit height of a seated worker); **carry-walk←** / **carry-walk↓** / **carry-walk↑** (4 each, arms locked forward and up, leaning back from the weight); **toss** (3: swing back, throw, follow-through); **dust-off hands** (2); spare. Walk→ is mirrored in code. |
| worker sheets: rows 10–11 (all skins + `-polo`) | 192×792 | +8 frames | **lifted** (2: legs dangling, arms up, seen from the side), **struggle** (2: legs kicking, cartoon), **carried↓** (2, front view for walking toward the camera), **tossed** (2: mid-air spin, legs up). Characters become 11 rows: update `characters.frame.rows`. |
| `objects/door-open.png` | 128×64 | 4 of 32×64 | The entrance door opening and slamming (closed, ajar, open, slam). |
| `ui/fx-dust.png` | 128×32 | 4 of 32×32 | Dust cloud where the worker lands outside the door (bigger than fx-poof). |
| `ui/fx-shoe.png` | 16×16 | 1 | A shoe left behind on the floor for a few seconds (comic). |
| `objects/chair-spin.png` | 128×32 | 4 of 32×32 | The empty chair spinning after its worker is lifted. |
| `ui/marker-out.png` | 32×16 | 2 of 16×16 | Little "OUT" stamp that pops above the door. |

### Bench on fire (closing a Project)

| File | Size | Frames | Notes |
|---|---|---|---|
| `objects/bench-ignite.png` | 576×64 | 4 of 144×64 | Sparks from a monitor, a small flame catching the desk. |
| `objects/bench-fire.png` (redraw) | 864×80 | 6 of 144×80 | Full blaze loop over the whole 4-seat bench, taller flames, bright core, dark smoke tips. |
| `objects/bench-collapse.png` | 576×64 | 4 of 144×64 | Desk sagging, monitors falling, legs buckling, a charred heap. |
| `objects/bench-ash.png` (redraw) | 288×48 | 2 of 144×48 | Ash heap with glowing embers, 2-frame ember flicker; the last state that stays until reload. |
| `ui/fx-smoke-column.png` | 192×96 | 4 of 48×96 | Tall smoke column rising from the fire, loops. |
| `ui/fx-embers.png` | 96×32 | 3 of 32×32 | Floating sparks around the fire. |
| `objects/fire-alarm.png` | 32×16 | 2 of 16×16 | Red wall alarm light, on/off, blinks while the bench burns. |
| `objects/extinguisher.png` | 16×32 | 1 | Extinguisher on the wall next to each column of benches (decor). |
| `ui/tag-burnt.png` | 64×16 | 1 | Charred version of the hanging team sign (grey, singed edges). |

Add everything to `manifest.json`: `characters.bouncer` (with `rows: 10`), `objects.doorOpen`, `objects.chairSpin`, `objects.benchIgnite`, `objects.benchFire`, `objects.benchCollapse`, `objects.benchAsh`, `objects.fireAlarm`, `objects.extinguisher`, `ui.fxDust`, `ui.fxShoe`, `ui.fxSmokeColumn`, `ui.fxEmbers`, `ui.markerOut`, `ui.tagBurnt`, and a `layout.animations` block giving each sheet's frame size and count. Keep existing keys.

## Round 6: floor selection and the Orcha-style Conversation (2026-10-30)

The code already draws these with plain shapes or emoji; these files replace them. The full list of everything still to draw (Rounds 3–6, duplicates removed) is in [asset-checklist.md](asset-checklist.md), and `bun scripts/check-assets.ts` checks it.

### On the floor

| File | Size | Frames | Notes |
|---|---|---|---|
| `ui/hp-bar.png` | 32×8 | 9-slice | Frame of the HP bar over each Agent; HP is the account fuel left. |
| `ui/hp-fill.png` | 24×12 | 3 strips of 24×4 | Fill: green, gold (low), red (almost empty). |
| `ui/select-marker.png` | 32×16 | 2 of 16×16 | Bobbing arrow over the selected Agent. |
| `ui/select-ring.png` | 128×24 | 2 of 64×24 | Glow ring under the selected Agent's feet. |
| `ui/name-plate.png` | 24×12 | 9-slice | Plate behind the name tag under the selected Agent. |
| `objects/team-sign-hanging.png` | 96×32 | 9-slice | Team sign hanging from two chains at ceiling depth; grey face, tinted per Project. |
| `ui/fx-bubble-stage.png` | 80×16 | 5 of 16×16 | Stage icons: thinking, coding, testing, reviewing, finished. |

### Boss popup

| File | Size | Frames | Notes |
|---|---|---|---|
| `ui/act-icons.png` | 200×20 | 10 of 20×20 | One matching icon set for the popup: tap, knock, bonk, megaphone, buzzer, whip, zap, coffee, high-five, gags. The popup is now one slim row of icon buttons, so the icons carry it. |
| `ui/popup-frame.png` | 48×48 | 9-slice | Plain dark plate, 1px border, hard shadow. Keep it simple. |
| `ui/popup-tail.png` | 14×8 | 1 | Tail pointing at the Agent. |

### Conversation and shell

| File | Size | Frames | Notes |
|---|---|---|---|
| `ui/icons-ui-16.png` / `ui/icons-ui-32.png` | 112×96 / 224×192 | 7×6 grid | Round 4 icons plus: show-on-floor, tool, pencil, key-enter, key-esc, branch, commit, worktree, file, folder, diff, fuel, tab-chat, tab-changes, tab-files, tab-setup, warning, check, cross, push, pull. Order in `layout.iconsUi.order`. |
| `ui/stage-strip.png` | 128×32 | 2 rows | Orcha-style THK · COD · TST · END strip; top row off, bottom row on. |
| `ui/git-status.png` | 64×16 | 4 of 16×16 | Change badges M, A, D, R. |
| `ui/skin-frame.png`, `ui/skin-frame-selected.png` | 40×40 | 1 | Skin picker cell in the Setup view. |
| `ui/favicon-32.png`, `ui/favicon-needs-32.png` | 32×32 | 1 | Browser tab icon; the needs version has a gold "!". |

Add everything to `manifest.json` under `ui` / `objects`. Keep existing keys.
