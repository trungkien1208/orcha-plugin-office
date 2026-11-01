# Easy Job floor — in progress

Worktree: `../PartyAgent-2-floor`, branch `build/floor`, based on `f039cfd`.
Art import: `4a11a28` (`art: office sprites, cast and boss`). No merge will be performed.

## Checklist

1. [x] Real manifest art, tinted layers, tags and portrait helper.
2. [x] Manifest frame rows and nearest-frame fallback.
3. [x] Front wall, live KPI/clock, props and rate-limited gong.
4. [x] All five status visuals.
5. [x] Agent entrance, seating, departure and Bench reorder lifecycle.
6. [x] Camera pan, integer zoom steps, semantic overview and selection.
7. [x] Boss actions and reactions; fun actions never call `onAction`.
8. [ ] Focus-safe keyboard and reduced motion.
9. [ ] Pure unit coverage.
10. [ ] Standalone `?demo`, mutation controls and real-browser acceptance screenshots.

The demo entry is built during item 1 and expanded throughout; item 10 records its final acceptance.

## Requests to Cursor

- Integrate the exported `FloorView` prop contract into Home; this branch cannot edit Home/store/API. The legacy no-props mount remains safe but cannot read the store.
- Supply/persist a seat address `{projectId, benchIndex, seat}` per stable Agent identity. Bench counts stay in the floor runtime and reset on reload; the legacy flat-index FloorMemory is not used as an overflow count.
- Supply stable `agentKey` and manifest cast Skin IDs. Local identity fallback is session value → terminal id → pane id; no bridge/shared edits here.
- Supply persisted Done-today totals per Project and a token-checked `done.mp3` URL through floor settings. Until then, use explicitly labelled local session KPI totals and a synthesized gong, never fetch private files directly.
- Wire optional `onSearch()` to the shell search input (`/` is handled only while the floor host has focus). The demo focuses a local search field.
- Route work callbacks (`tap`, `knock`, `bonk`, `megaphone`) to selection/Seen, nudge Prompt, confirmed interrupt and broadcast respectively. Fun actions remain entirely local.
- Wire root `?demo` to the floor if desired. The independently served Vite entry `/src/floor/demo.html?demo` bypasses bridge/token gates without editing App.

- The baseline Vite config cannot resolve shared runtime exports. Floor imports are type-only with a local empty-state stub; Cursor should fix the package export/alias outside this scope.

## Evidence and commits

- Setup: worktree created exactly from `f039cfd`; art committed; `bun install` completed.

- Item 1: real manifest assets, native 64×16 tinted tags with fitted ellipses, LINEAR text after fonts ready, per-key fallback, portrait helper. Browser: floor-02-tags.png and floor-03-host.png, no page errors. Host uses Scale.NONE, capped DPR and ResizeObserver; layout expands to the column at 1×.

- Item 2: frame registration respects manifest columns/worker rows/bossRows and actual PNG geometry. Missing shock falls back to stand↑26; other missing frames choose the closest available frame. Browser: floor-04-frames.png.

- Item 3: pale wall 9-slice over a pale backing, two native 96×48 night windows, red banner, top-five KPI with flower, recruitment poster, clock hands/live time, CCTV, native props and bottom glass office. Done transitions strike the gong at most once/2s; supplied sound is capped at 1.9s, local audio cue until Cursor supplies its URL. Browser: floor-05-wall.png.

- Item 4: all five screen/pose/marker combinations, fully standing hand-up with chair behind, Zzz sleep sprites, unknown faded/static, blocked Bench outline; reduced motion freezes each effect. Browser: floor-06-statuses.png.

- Item 5: fixed 4-seat overflow Benches follow Project order, retain stable addresses and runtime overflow counts, slide on insertion; added/removed Agents walk via the door with sit/stand/fade phases. A closing Project keeps its Bench until departures finish. Supercover path smoothing avoids corner cuts and out-of-bounds starts. Test covers 4→5→3→reload. Browser: floor-07-lifecycle.png (entry paths and completed departure verified).

- Item 6: host-sized DPR canvas, integer 1×/2×/3× zoom, two-finger pinch steps, drag pan and stable map dimensions while zooming; far 0.5× mode shows tags + status dots. Panel selection pans and pulses. Text uses inverse zoom and LINEAR filtering. Browser: floor-08-camera.png (wheel, drag and panel selection).

- Item 7: Boss path walking, 1.5-tile proximity menu, all nine animations/reactions/fx/local sounds, confirmed Bonk and a team-message form. Dispatch has a work-only gate; all five fun actions and cancelled Bonk left the demo callback count at zero, Tap raised it to one. No Agent status is changed optimistically. Browser: floor-09-boss.png. Fun activity is local; Cursor may add a separate local-activity callback, never reuse onAction.
