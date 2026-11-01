# Easy Job final art batch

Production assets: `packages/web/public/office/`. Built-in image generation supplied the HR character and three compound panoramas; native pngjs finishing supplies exact grids, palette, alpha and contours. Modular geometry, effects, UI and the existing cast extensions use the Rounds 1–2 pixel renderer. [Source prompts and receipts](round6-sources/receipts.json) are saved locally.

- [A — carrying, door, chair and bench lifecycle](round6-a.png)
- [B — selection, fuel and team signage](round6-b.png)
- [C — compound and office decor](round6-c.png)
- [D — shell and popup artwork](round6-d.png)

All 23 worker sheets and matching polo layers are 192×792, with their first nine rows preserved. Frames 36–37 are lifted, 38–39 struggle, 40–41 carried down, and 42–43 tossed. HR is 192×720 with 40 frames, including directional walking/carrying, reach, grab, toss and dust-off. The boss sheet is preserved. Manifest layouts describe all 255 production PNGs, including legacy sheets; original consumer paths remain intact.

The checklist changed during production: three separate popup action pictures became one ten-icon strip, reducing the live count from 106 to 104. Both versions are fulfilled. The original individual pictures are retained alongside `act-icons.png`. The unchanged checker was run against a temporary copy of the original checklist and the actual production asset directory; [the checked original list](round6-original-checklist.md) and [its 106/106 result](round6-original-check.txt) are retained. The final command against the live checklist reports [104/104](round6-d-check.txt). The checker itself was not modified.

Additional validation: **2,858 checks, zero errors**, covering palette and binary alpha, reserved gold, all sheet layouts, occupied frames, transparent spare UI cells, cloth-only masks matching base pixels, preserved worker rows, retained legacy manifest paths and contact sheets. See [validation data](round6-validation.json).

Reproduce the art with `node tools/office-art/round6.cjs A` (then B, C, D), followed by `node tools/office-art/round6-finalize.cjs`, `bun scripts/check-assets.ts --write`, and `node tools/office-art/round6-validate.cjs`.

No assets are unfinished. No source files under `packages/*/src` were edited by this art pass; unrelated live workspace changes were left in place. No Orcha operations or commits were performed.
