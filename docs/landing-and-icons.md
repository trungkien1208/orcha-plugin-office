# Easy Job: reception + the native Floor

## Code map (`packages/web/src/landing/`)

| File | Does |
|---|---|
| `main.tsx` | Entry (root `index.html`): fonts, CSS, mounts `Landing`. |
| `Landing.tsx` | Theme, Calm, install dialog; Reception over Office, Pitch below. |
| `useEntrance.ts` | Reception → office sequence (measure door, load art, open, zoom, `#office`). |
| `Reception.tsx` | Staff pass, Clock in, CSS door (WebGL fallback) under the lazy `ReceptionDoor.tsx` (three.js). |
| `Office.tsx` | Sample office state (Answer/Seen, Projects, N for next Question) around the lazy `NativeFloor.tsx` (Phaser). |
| `Pitch.tsx` | Below the office: newspaper, pinned notice board, staff rules and punch-clock time card. |
| `Install.tsx` | Install commands with Copy (shared by the dialog and the pitch). |
| `data.ts` | Sample cast, copy and links (`REPO_URL` empty hides the GitHub link). |
| `art.generated.ts` | Logo, portrait, paperwork, sheet, frame and animation metadata emitted from the manifest. |

The root landing has two screens using Easy Job's existing Cozy Office / Compound theme:

- **Reception:** a perspective 3D entrance and a physical staff pass. `landing/ReceptionDoor.tsx` uses Three.js geometry for the wall opening, thick door leaf, hinges, handle, sign and threshold. The leaf rotates into the hall and a perspective camera travels through the opening. The 3D renderer is separate from the office renderer, renders on demand while idle, pauses in hidden tabs and is disposed with its GPU resources after entry. A CSS entrance remains as the WebGL fallback. Clock in flips CLOSED to OPEN, centers/scales the door, waits for real art/code/font loading, opens the door, then zooms through the empty doorway. There is no miniature office preview. Retry handles failed assets; reduced motion skips the animation delays.
- **Main office:** the actual Phaser Floor, with twelve native characters and the existing floor tiles, benches, chairs, monitors, plants, lounge and office cat. A Conversation note and Project folders provide readable information outside the map.

`#office` opens the main view directly. The wordmark returns to reception. All work is sample data local to the tab: the page never calls the bridge or controls real Agents.

## Build and preview

```sh
bun install
bun scripts/build-landing.ts
bun scripts/preview-landing.ts
```

Open http://127.0.0.1:4173. The standalone entry is root `index.html`; Vite's relative base supports GitHub repository subpaths. Fonts, art and code are served locally. GitHub Pages uses the included Actions workflow; the revamp has one local commit per task; no push or deployment was performed.

## Native Floor reuse

`src/landing/NativeFloor.tsx` extends the existing `FloorScene`, reusing `Art`, `Room`, `Wall`, `Statuses`, `Boss`, `FloorKeyboard`, the collision layout and pathfinding. There is no second percentage-based Boss route or DOM sprite simulation. Native desk coordinates put Agents directly on their matching chairs.

The landing adapter fits the complete 896×704 room into its viewport, including the original back wall/windows/decor, both side walls and a split front wall with an entrance. Wall faces reuse the native wall texture. The wider sample layout is built with the native layout helper; the Cozy Office Boss desk reuses the existing bossOffice asset and adds corresponding blocked cells. Production layout behavior is unchanged. It keeps the camera still while the Boss walks. It hides the overhead team signs and redundant status bubbles, retaining the needs-you marker, selected seat ring and a single You label. The page uses one connected work surface: a large Floor on the left, compact Projects and the selected Conversation on the right. The tall-screen Conversation includes a compact Bench roster; phones keep Project controls and move the Conversation below the map.

The Boss tours desk approaches using native paths. Keyboard movement and clicks take priority for 12 seconds; clicking a blocked tile stops the previous automatic route. Check-ins update the footer and can send a native paper plane between teammates. Calm stops the tour and native character/decor animation. Reception and hidden tabs pause the scene and sleep the game loop.

This compact 2D landing uses Phaser's Canvas renderer at logical 1x resolution. That avoids a DPR-squared framebuffer on large displays and the measured software-WebGL bottleneck in the browser test environment. Sprite positions remain fractional while art uses nearest-neighbor rendering. The production app's renderer/settings are unchanged.

`src/landing/native-art.ts` loads native manifest groups with eight concurrent image decodes. It excludes landing illustrations and gate art. The Phaser module is loaded separately from the initial reception bundle and is awaited during Clock in.

## Interactions and brand

- Select an Agent in the canvas, or tab through the accessible Agent controls, to read the sample Conversation. Answer changes Needs-you to Working; Mark Seen changes Done to Idle. Monitors and counts update together.
- Project folders select a team; compact controls remain below the room on phones.
- Focus the map and hold arrows/WASD for direct movement, or click a walkable tile for a native path. N selects the next Question.
- Both themes reuse their original native assets. Setup opens a native dialog with installation commands, copy fallback and Escape dismissal.
- The Easy Chair e/j logo remains registered as `manifest.landing.brandMark`. Conversation body text reaches 20px on 2560px-wide displays.
- The native icon family is generated by `node tools/office-art/pixel-icons.cjs`; its gallery is `/office/ui/pixel/index.html`.

## Verification

With the built preview running:

```sh
node scripts/check-landing-layout.mjs
node scripts/check-landing-activity.mjs
```

The layout check uses `?demo` to inspect the native scene and verifies twelve characters/chairs, real seated coordinates, both themes, readable type, whole-map bounds and all four wall sides, Answer/Seen, held-key Boss movement, installation copy/Escape and reception re-entry. It covers 16 viewport/DPR combinations: 2560×1440, 2560×1283, 2048×1152, 1920×1080, 1440×900, 1024×700, 2048×1029 and 390×844 at DPR 1/2.

The activity check observes entrance phase transitions, actual 3D hinge rotation and camera travel, no preview/generated room requests, native textures/seats, continuous Boss positions, blocked Bench collision, hidden-tab pause, Calm/reduced motion and failed asset retry. Current screenshots include `door-real3d-*`, `office-revamp-final-*`, `native-*`, `boss-office-*`, `boss-compound-*` and `reception-intro-*` under `docs/review/`; earlier illustrated-room captures are superseded.


## Office paperwork revamp

`Pitch.tsx` keeps the newspaper, rules and time card as selectable HTML. The masthead, paper edges, cork, pins, tape and punch marks come through `manifest.landing.officePaperwork` / `compoundPaperwork`. The Daily Standup dateline uses the visitor's clock. Phones use a single column for paper and pinned notes.

`Vignette.tsx` uses small Canvas 2D scenes, without loading Phaser for the pitch. It reads sheet dimensions, animation names/frames and effect dimensions emitted by the build; there are no character row constants in the component. The Bench scene tints only the polo masks in the Project colour. Needs-you and Done notes are keyboard-accessible buttons. IntersectionObserver, page visibility, Calm and live reduced-motion preferences control RAF; Calm renders real still frames and omits planes/stamps.

The shared `InstallCommands` component renders the same commands in the dialog and time card. Successful Copy punches a local time into every command row; blocked clipboard access selects only executable command text. New chair sizes, favicon, touch icon and social preview are wired with relative paths. New art remains pending human approval: see `docs/art-review/landing-revamp.md`; no approval hashes were recorded by Codex.

Final review captures use `docs/review/landing-revamp-*`. Reproduce the requested reception/office/pitch/Calm matrix with `node scripts/capture-landing-revamp.mjs` after building and starting the preview. Layout checks include pitch bounds; activity checks include every Calm vignette, interactive note states, clipboard fallback, hidden-tab and offscreen pauses.
