# Codex UI tasks: wire every approved asset into the app, landing page, gate page (2026-10-31)

All art in `packages/web/public/office/` is approved (185/185, `docs/asset-checklist.md`), but about two thirds of it is not used by the app yet. This plan wires it in. Claude reviews when you are done.

## Rules

- Only edit `packages/web/` (src, index/landing/gate HTML, Vite config). Cursor owns `packages/bridge`, `packages/shared`, `scripts`; if you need something from them, use the fallback written in the task and note it in `docs/PROGRESS.md`.
- Do not change or redraw art. If a piece looks wrong in place, note it in `docs/PROGRESS.md`.
- Never modify Orcha. No network requests at runtime (fonts and art are local). Agent output stays untrusted text, never HTML.
- Both themes: every placement must work in Compound and Cozy Office (office art comes from `manifest.themes.office` through the existing `artPath` / `Art.object` lookup; office-only keys only in office).
- Calm mode and reduced motion: no flicker, sweep or loops; static frame 0.
- Keep the Floor walkable: anything placed on the floor blocks its cells in `packages/web/src/floor/layout.ts`, and `layout.test.ts` (every desk reachable from the door) stays green. Add a test that the door, every desk approach tile and the lounge/office entrance stay reachable.
- Readable over decorated: decoration never sits behind text, never covers an Agent, a desk, a team sign or the selection ring. Low contrast, sparse.
- One commit per task, Conventional Commits, no push. `bun run check` green after each.
- Screenshots after each section in `docs/review/codex-<task>-<theme>.png` (1440×900, plus 1024×700 for shell tasks).

## U0. Leftovers from the last review (frontend)

Do these only if `git log` does not already show them fixed:
- G1 `Bouncers.cancelBring` for a queued (never started) carry-in: skip the carry-out, destroy the hidden sprite and zone at once; mid-carry: make the worker visible before the carry-out. Test the "never started" branch.
- G2 Conversation at 1024 px: the header "Details" button is overlapped by the Show-on-Floor icon button. Fix the gaps.
- G3 Rail at 1024 px: a blocked Agent row lost its waiting time; show the compact label (now, 3m, 1h) with reserved width.

## U1. Compound Floor decoration (`floor/Wall.ts`, `floor/Room.ts`, `floor/layout.ts`)

Place every unused Compound object with intent, not scattered. Suggested placement (adjust to fit, keep the rules):
- **Outside** (`EXTERIOR` band): `compoundNight` by default, `compoundNight2` some nights (pick by local date), `compoundDusk` between 17:00 and 19:00 local time. `razorWire` tiled along the top of the front wall, `wallLamp` pairs on the wall top, one `searchlight` sweeping (2–4 fps), `neonSign` over the gate, rooftop `waterTank`, `satelliteDish`, `tangledCables`.
- **Front wall** (y < 192): `bannerHanging1..3` between windows, `bannerWide2` on the second wall section, `posterKpi`/`posterTarget`/`posterTeam` near the door, `tvLeaderboard` showing the same top teams as the KPI board (draw the text over the screen like the KPI board does), `noticeBoard` by the door, `fireAlarm` stays on burning benches only.
- **Ceiling**: `ceilingLight` over each bench row with a soft `lightPool` under it (alpha ≤ 0.35); one `tubeBroken` flickering (static in calm); `bulbBare` in the boss office corner. Lights sit above Agents in depth but are drawn faint.
- **Floor**: tile variants `floorWear`/`floorDirty`/`floorCracked` on a stable pseudo-random ~12 % of floor tiles (seeded by tile x,y); `floorTape` along the central aisle edges; `stainDamp`, `crackWall` on the side walls; `leakBucket` in one corner.
- **Side columns** (the prop cells): `lockerRow`, `shrine` (red lamp blinks slowly), `waterCooler`, `waterJugs`, `stackedChairs`, `printerBig`/`printer`, `shredder`, `serverRack`, `generator` (hums: 2 frames), `fanRusty`, `extensionMess`, `drinkCrates`, `noodleBoxes`. Add any new blocked cells to `layout.ts`.
- **Boss office**: `moneyCounterTable`, `supervisorPodium` by the aisle, `deskPhone`.
- **Entrance**: `turnstile` beside the door (the carry-in and carry-out walk past it, not through it), `extinguisher` by each bench column.
- **Desks** (Room): per seat, a stable pseudo-random 1–2 items from `phoneTray`, `laptopOpen`, `simCards`, `cashSmall`, `snackPack`, `ashtray`, `nameCard`, `batteryLamp`, `mug`, `noodleCup`, `energyDrink`, `papers`, `deskFan`, seeded by the seat so they never move between renders. Never on the monitor or the screen rectangle.
- `dormBlock`/`dormDoor` stay unused (the dorm was removed on purpose).

## U2. Cozy Office leftovers

- `cityDusk` outside between 17:00 and 19:00 local time, else `cityDay`.
- `deskLamp` on every occupied desk (warm, static).
- `whiteboard` on the front wall in place of the KPI board only if the theme manifest maps it so; otherwise beside it. KPI text stays readable.
- Office Boss portrait (`themes.office.characters.bossPortrait`) for the Owner's avatar in chat and the header when the theme is office.
- Office cat already wanders; make sure it never sits on the door tile or a desk approach tile.

## U3. Shell pieces (`theme.css`, `looks.css`, `chat/`, `home/`, `ui/`)

Use the art as CSS `border-image` (9-slice) or `background` sprites; text always on a solid colour:
- `panelFrame` + `panelHeader`: the card frames and card headers in Compound (office uses `themes.office.ui.panelFrame`).
- `crtBezel`: around the Floor canvas in Compound only (inside the map frame), plus `cctvCorners` and two `cornerLamp`s on the map card.
- `hazardTape`: replace the CSS stripes for "needs you" strips with the art.
- `stampUrgent` on the Needs-you card, `stampDone` on a done toast/row for a few seconds, `stampClosed` on a closed project's rail row.
- `avatarFrame` around portraits; `avatarFrameNeeds` when the Agent needs you.
- `skinFrame` / `skinFrameSelected` for the skin picker in Setup.
- `stageStrip`: THK · COD · TST · END in the agent header and the rail's running rows, lit from `agent.stage` (thinking/coding/testing/reviewing/finished; until Cursor ships `stageStep` in shared, map words in `agent.stage` yourself).
- `fxBubbleStage`: small stage icon over working Agents on the Floor.
- `gitStatus` badges in the Changes list and the context panel.
- `badgeModel` next to the model name (opus, sonnet, haiku, gpt, codex, cursor, other; until Cursor ships `modelFamily`, derive it from `agent.model` / `agent.kind`).
- `cursorBoss` on the Floor canvas, `cursorHand` over clickable Agents and team signs.
- `emptyInbox` (no agent selected / no messages), `emptyFloor` (no Projects), `orchaDown` (Orcha not running) in the empty states.
- `favicon32` and `faviconNeeds32` as the tab icon, switching when someone needs you; app icons in the HTML head.
- `spinner16` and `thinkingDots` replace the CSS spinner and the working line's dots.
- `hpBarLg` + `hpFillLg` + `staminaFillLg` + `hpIcons` replace the CSS health bars in the agent header.
- `notePaper` + `tapeCorner` for tips and empty states; `clipboard` frame for the Setup tab blocks; `dividerFence` between the rail and the chat in Compound.
- `stickerSet`: at most two stickers, on the Floor card corner and the empty state, never over text.
- `popupFrame` + `popupTail` for the Boss popup on the Floor (Compound and office versions).
- Unused small UI (`walkie`, `newspaper`, `zapper`, `bubbleTail`, `fxPoof`, `fxSmoke`, `icons32`, `iconsUi32`, `actTap/Knock/Highfive`): use where they fit (32 px icons for large buttons, `fxPoof` when a carried-out worker lands), else leave them.

## U4. Landing page

A static page at `/landing` (Vite multi-page: `packages/web/landing.html` + its own entry), served without a token (Cursor adds the bridge route; until then `bun run --cwd packages/web dev` serves it).
- Sections: hero (`landing/hero.png` scaled ×2–3 nearest, wordmark, one-line pitch "Run your AI agents like a compound boss", a "How to run" code block `bun run install-local && easy-job`), four features (`featureFloor`, `featureChat`, `featureHp`, `featureHr`) with short copy, a theme strip showing both looks, footer.
- `divider-wire` between sections, `bg-tile` behind the page at low contrast, `og-image` and app icons in the head.
- English copy, no tracking, no external fonts or scripts, works at 375 px wide.

## U5. Gate page (before entering the compound)

Shown by the app while it connects, instead of the plain gate card:
- **Connecting**: `gate/gate-night.png` (office: `themes.office.gate.lobbyDay`), the `badgeCard` with the Boss portrait and the token's first 6 characters, `loadingFrame` + `loadingFill` progress, `turnstileAnim`.
- **Approved** (token accepted and state received): `stampApproved` thumps on the badge, `gateOpen` plays (office: its glass doors), then the app fades in. Skip the animation in calm/reduced motion.
- **Denied** (no token or 401): `stampDenied`, text "Open Easy Job from the terminal: `easy-job open`".
- **Orcha down** (bridge up, Orcha not connected): gate stays closed, `orchaDown` art, "Orcha isn't running" and the Start Orcha button if the bridge offers it.
- Show it at most once per load; reconnects inside the app keep today's amber state instead.

## Done when

- Every approved asset is either used or listed in `docs/PROGRESS.md` with a reason (e.g. dorm removed).
- `bun run check` green; `layout.test.ts` and the new reachability test green.
- Screenshots for U1–U5 in both themes in `docs/review/`, plus 1024×700 for U3 and 375×800 for U4.
- A summary per task with its commit in `docs/PROGRESS.md`.
