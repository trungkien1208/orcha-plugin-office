# Orcha Office art delivery

Production PNGs and the manifest live in `packages/web/public/office/`.

The default cast has the requested 16 IDs in order. All 15 human workers remain selectable alongside the 8 non-human workers: 23 skins in total, plus the boss. Violet is excluded.

Workers use 192×648 sheets: 4 columns × 9 rows of 48×72 frames. Their polo masks use the same layout. Portraits and portrait masks are 64×64. The boss uses 192×720: 4 columns × 10 rows.

Frames keep the completed drawings except for the requested replacements: worker attention frames 20–21 now stand upright, and boss frames 36–37 hold an electric baton. The finishing pass repaired missing cloth masks and normalized cloth shades without changing silhouettes or poses. Snapshots in `before-actions/characters/` preserve the completed first eight rows; validation compares every untouched original pixel against the revised sheets. The `before-polish/` snapshots cover all frames and portraits before these targeted changes.

New worker frames are 32–33: a cartoon static reaction and a skeleton flash. Robots show sparks and screen static instead of bones. Frames 34–35 are back-facing spare poses. Skeleton-flash frames intentionally have empty polo masks because no cloth is drawn.

Boss frames 32–34 are the overhead whip raise, crack and recovery; 35 is spare. Frames 36–37 hold the straight cartoon electric baton; 38–39 are spare. The whip cracks into empty air, with the burst above desk height. The new UI effects each contain three 16×16 cells. No gold appears in these new sprites.

## Integration coordinates

- Monitor screen: transparent rectangle at x=4, y=4, width=24, height=12.
- Bench tag tint face: x=2, y=5, width=60, height=7; mask in `bench-tag-polo.png`.
- Window: two 96×48 cells, total 192×48; only neon colours flicker.
- Gong: three 64×48 cells, total 192×48.
- CCTV: two 16×16 cells, total 32×16; one red LED blinks.
- Icons: 7 columns × 2 rows, giving 112×32 and 224×64. Order is recorded in `manifest.layout.icons`.
- Character feet are on local y=71. Use nearest-neighbour rendering and no image smoothing.
- Multiply tint over the polo mask, preserve its alpha, then composite over the base. Keep fur, hardware, lanyards and badges on the base. Tails should appear over the chair back; the office proof demonstrates the placement.

## Proofs and validation

Open [review.html](review.html) for pose, scale and uniform controls, full sheets, the assembled desk and the office floor. Standalone native PNG proofs are `cast-default-native.png`, `cast-extra-native.png`, `bench-proof.png`, `office-proof.png`, and `gag-proof.png`.

Run from the project root:

```sh
node tools/office-art/sync-actions.cjs
node tools/office-art/finish-animations.cjs
node tools/office-art/gag-fx.cjs
node tools/office-art/apply-polish.cjs
node tools/office-art/polish-ui.cjs
node tools/office-art/compose-polish.cjs
node tools/office-art/validate.cjs
```

Validation writes `validation.json`. It covers expected files and dimensions, manifest references and cast order, preserved frame pixels, binary alpha, palette membership, the gold reservation, grey-only masks matching their bases, transparent screens, occupied cells, feet registration, distinct front/back cast images, and desk joins. Native PNG proofs provide the visual check for recognisability and composition.

## Source prompts

The built-in imagegen tool produced the character and prop source art and the appended action strips. Full prompts and source receipts are in `receipts/`, `actions/`, `revisions/`, and `sources.json`. The imagegen CLI was not used. The modular tile/desk geometry, small UI glyphs and effect bursts were drawn directly on their native pixel grids. `tools/office-art/` contains the palette and frame-finishing scripts.

Raw generator images remain at their recorded local paths. Every runtime asset is saved in the project; the game does not depend on those raw images.

## Done when — final check

- [x] All 150 production PNGs exist at the required dimensions and are referenced by `manifest.json`.
- [x] All opaque pixels use the approved palette. Gold `#ffb020` occurs only in `ui/marker-needs.png`. Alpha is binary, polo masks use only the three tint greys and match their bases, and the monitor screen rectangle is fully transparent.
- [x] The 16 default characters are distinguishable at native 1× from the front and back. The cast order matches the request; all 23 skins remain listed; violet is absent.
- [x] A left cap + four middle segments + right cap with chairs and monitors reads as one continuous desk, with matching joins.
- [x] All 23 workers have 36 frames and matching expanded polo layers. The boss has 40 frames. Pixels outside the requested attention and baton revisions are preserved. The crack/zap effects and whip/zapper menu icons are present. Robots use screen static and sparks rather than skeletons.

The final automated run passed **1,586 checks with zero errors**. The native cast, reaction atlas, boss actions, assembled bench and office floor were also visually inspected.

**Missing items: none.**

## Current polish pass

All 23 attention loops now stand fully upright with an open palm above the head. The chair is drawn behind the standing character, so both legs stay visible. Nap frames 24–25 remain unchanged; the separate three-frame `ui/fx-sleep.png` effect supplies floating ZZZ. The gun-shaped gadget was replaced in the two boss frames and the menu icon by a straight cartoon electric baton.

The 768×832 compound preview adds six numbered long benches, phone charging, fluorescent fixtures, wall fans and dorm details. Its new 768×224 exterior shows dormitory blocks, concrete perimeter and a closed metal gate, palm trees and casino neon; the office stays bright. The compound renderer is shared by the browser preview and native PNG proof.

Latest proofs: `compound-polished.png`, `raised-hand-proof.png`, `raised-all-skins.png`, `sleep-proof.png`, and `baton-proof.png`. Native browser automation was unavailable during this pass; visual checks used the shared renderer’s PNG outputs, and both browser scripts were syntax checked.
