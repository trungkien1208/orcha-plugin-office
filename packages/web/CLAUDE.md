# web

React 19 + Vite + TypeScript, Phaser 3.90 for the Floor, react-markdown + remark-gfm + rehype-highlight for chat.
`bun run build` writes `dist/`, which the bridge serves; `public/office/` is copied in at build time, so after
art changes rebuild cleanly (`rm -rf dist && bun run build`) or the bridge keeps serving the old files. Biome lints
(`bun run check` at the root); there is no Prettier.

Two views, chosen by the store route (`src/store.ts`, no router): **Floor** (`home/Home.tsx`: Floor card + rail +
chat) and **Conversation** (`ProjectRail` + `ChatPanel` + `ContextPanel`, which becomes a drawer below 1280 px).
The rail (`home/ProjectRail.tsx`) groups Agents by Project with ⋯ menus; the chat lives in `chat/Chat.tsx`
(transcript, composer, question card, header) and `chat/Context.tsx` (fuel, git, files, setup). The header is
identity only (name, status, project · branch); account and model/effort/Fast are pills under the composer
(`ui/AgentPills.tsx`) that open popovers, and one Apply sends one model change. Dialogs are for what needs more:
hand-off, removing, closing, an account switch that must stop work or move other Agents. A third route is
**Settings** (`#settings/<section>`, `settings/Settings.tsx`: general, accounts, boss, connection); the top bar keeps
only navigation, Needs-you, counts, ⌘K, live/clock and the Settings button. Chat renders one block per Agent turn
(`byTurn` in `chat/Chat.tsx`); paths in Agent text link only when `chat/paths.ts` resolves them against the Agent's
file list, and open in `chat/Files.tsx` (folder tree from `chat/file-tree.ts`). Bridge images (uploads, repo images)
need the bearer token, so they render through `ui/AuthImage.tsx`, never a bare `<img src>`. New agent and New
project live in `home/Launch.tsx`. Prefer a library to hand-rolled UI plumbing: popovers are placed by
`@floating-ui/react-dom` (`ui/usePopoverPosition.ts`), the Files tree is `@headless-tree` (rows rendered by us),
outcomes of actions are `sonner` toasts (`toast.success/error`; context that belongs to a dialog stays inline).
Icons come from
`ui/Icon.tsx` (native pixel icons by semantic name, backed by `floor/PixelIcon.tsx`).
The Floor action menu uses the same mint/peach/lavender family without importing the app shell.
`node tools/office-art/pixel-icons.cjs` regenerates the manifest-backed sheet, TypeScript index and light/dark preview gallery. Styles: `theme.css`
(tokens and components) and `looks.css` (theme decoration, Cozy Office palette, calm mode). UI copy is English.

## Floor (`src/floor/`)

Self-contained: it takes `FloorInput` (office, selection, settings, callbacks) and must not import the app store
or API (ADR 0005). `FloorScene.ts` owns the loop; `Room.ts` draws benches, signs and the burn/pack sequences;
`Wall.ts` the wall, outside and decor; `Bouncers.ts` HR carry-in/out (pair queue, max 2 pairs); `Boss.ts` the
player and actions; `Camera.ts` zoom, follow, selection marks; `Cat.ts` the Cozy Office cat; `layout.ts` the
append-only bench layout and walk grid (anything placed on the floor must block its cells, and `layout.test.ts`
keeps every desk reachable from the door).

## Gotchas (all found the hard way)

- **Art lookup**: always go through `Art.object` / `Art.sheet` / `artPath(bank, group, key, theme)`; themed keys win
  only when their image loaded. `Art.sheet` needs `layout.animations[key].frame`; `Art.play` builds and caches the anim.
  Missing art must draw nothing (or a fallback), never a grey box in decor.
- **Text in the canvas**: create texts with `crisp()` and rescale with `refreshText()` (1/zoom) so they stay sharp in a
  `pixelArt` game; redraw after `document.fonts.ready`.
- **Type inference cycles**: helpers that take `FloorScene` and are fields of it (`cat`, `bouncers`) need explicit
  types (`cat: OfficeCat = …`, annotate locals read from `scene.layout`), or tsc reports "implicitly any".
- **Worker frames**: 11 rows of 4 (rows 9–10 are lifted/struggle/carried/tossed); the bouncer has 10 rows with named
  animations in `manifest.characters.bouncer.animations`. Read frame numbers from there, not memory.
- **Calm and reduced motion**: `scene.reduced` is true for both; skip fire, flicker, carries and loops when set.
- **CSS stacking**: a `transform` or `opacity` on a menu's ancestor creates a stacking context, so its popover sits
  under later rows. Raise the open row (`:has(.menu-anchor.open)`) instead of adding transforms.
- **The top bar clips** (`overflow: hidden` to stop horizontal scroll): decoration under it (razor wire, vine) is drawn
  inside the bar as a bottom background, not a pseudo-element hanging below.
- **Biome `noDescendingSpecificity`**: prefer a unique class (`.slash-name`, `.quick-input`) over a deeper selector when
  a later rule would be shadowed.
- **Icon-only buttons** must keep a visible text label or `aria-label` + tooltip; an empty sprite cell renders as an
  empty square.
- **Chat columns**: owner messages put the body first and the portrait last (`grid-template-columns: 1fr 32px`); a
  swapped order squeezes the bubble into the 32 px column.
- **Container queries**: the agent header adapts to the chat width with `@container conv`, not the viewport.
- `pathfinding`'s `Util.smoothenPath` is not used; paths come from `motion.ts` / `path.ts`.

## Checking your work

`bun run dev:fake` (repo root) serves the build on 127.0.0.1:4599 with sample Projects and Agents; the URL with its
token is printed and written to `.dev-fake.url` (a restart makes a new token). The fake Orcha creates agents on
`agent.start`, closes panes and workspaces, and answers questions, so carry-in, remove and close can be seen.
Check both themes, calm mode, 1440×900 and 1024×700; Playwright scripts are fine for screenshots.
