# Landing revamp: one batch for Codex

Owner verdict on the current landing: it reads like a generic AI-made page. Keep the reception door, the staff
pass, the playable Floor and the Projects/Conversation column. Redo the part below the office and the copy so the
page feels like it was made inside the Easy Job office, not from a SaaS template.

Read first: `CONTEXT.md` (domain words), `docs/art-brief.md`, `packages/web/CLAUDE.md`, `docs/landing-and-icons.md`
(code map of `packages/web/src/landing/`).

## What is generic now (do not repeat)

- Eyebrow in spaced caps above every heading (`WELCOME BACK, BOSS.`, `A NEW KIND OF OFFICE HOURS`,
  `EASY JOB FOR ORCHA`).
- Big headline ending in an accent-coloured period: "Time to clock in.", "The team's already on it.",
  "Your Agents, at their Desks.".
- Slogan pairs and triads: "Different Desks. Same big picture.", "Come for the overview. Stay for the office cat.",
  "Big jobs. Small office.", "A Bench for every Project. A little more life in your workday."
- The pitch section: three equal white cards, an icon in a rounded box beside a bold line and a grey sentence,
  orange CTA plus underlined text link. This is the part the owner dislikes most.
- Accent-coloured primary button with a ↗ arrow repeated four times on one page.

## Direction: the office's own paperwork

Everything below the office is an object you would find in that office, drawn with the existing pixel art and the
existing character sheets. The top of the page is where you clock in at the door; the bottom is where you take a
time card home.

1. **The office paper** (replaces eyebrow + h2 + paragraph). A newspaper front page in the `ui.newspaper` style:
   masthead (e.g. "THE DAILY STANDUP"), one headline, a short column of body copy that explains what Easy Job is,
   a dateline from the visitor's own clock. Copy is plain and specific: Orcha workspaces become Benches, Agents sit
   at Desks, you walk the Floor as the Boss and answer whoever raised a hand.
2. **The notice board** (replaces "What happens here"). A cork board (`objects.noticeBoard` / Cozy `whiteboard` as
   reference) with pinned paper notes (`ui.notePaper`), slightly rotated, each with a small live vignette made from
   the real character sheets, not icons:
   - Bench: four Agents `typeUp` at a Bench tag in their Project colour.
   - Needs you: one Agent `handUp` with `ui.markerNeeds` bouncing; hover/click stamps `ui.stampUrgent` → it goes
     back to typing.
   - Done and Seen: an Agent `relaxUp`; click stamps `ui.stampDone` and it becomes idle.
   - The Boss: Boss `walkDown`, throws `ui.fxPaperPlane` to a Desk (Nudge / Broadcast).
   - HR bouncers: the bouncer carries an ended Agent out (`characters.bouncer.animations`). Only Easy Job has this;
     make it the joke of the board.
   Calm mode and reduced motion: each vignette shows one still frame, no stamps animating, no plane.
3. **Office rules** (replaces "House rules"). A printed notice taped on the wall: numbered rules, staff-notice
   tone ("1. Everything stays on this machine…"). Same three facts: local only (127.0.0.1, per-run token, no account,
   no telemetry), stopping work always asks first, Calm mode.
4. **Time card** (replaces the install card). A punch-clock time card matching the staff pass at the door
   ("TIME CARD · Nº 001 · THE BOSS"). Each install command is a row; Copy punches a time into the row. Keeps the
   select-text fallback when the clipboard is blocked, and the Bun 1.4+ / Orcha 0.9.12 requirement line.
5. **Footer**: one line, no slogan pair.

Both themes: Compound gets the same objects in its darker palette (`--paper #18221d` family), not a recolour filter.
Phones: board notes stack in one column, the newspaper becomes a single column, the time card stays readable at 390px.

## Tasks (one commit each, in this order)

### T1 · Consolidate `landing.css` (no visual change)

`packages/web/src/landing/landing.css` is ~4,400 lines of layered iterations (17 `.workplace` rules, many repeated
selectors and media blocks, `!important`s). Rewrite to one rule per selector per breakpoint, shared breakpoints, no
`!important`, no dead selectors. Target under 1,800 lines. Before you start, capture screenshots of reception and
office at 390×844, 1024×700, 1440×900, 2560×1440 in both themes; after, capture again and compare. Differences must
be intentional and listed in the progress log. Biome warnings for this file go to zero.

### T2 · Art

All through the manifest, approved by a human (`bun scripts/check-assets.ts --approve <path>`); do not approve
yourself. Reuse existing art first, generate only what is missing:

- Pitch objects: cork board surface (tileable), push pins, paper note variants, newspaper masthead, wall notice
  with tape, time card + punch stamp. Both themes where colour differs. Keys under `manifest.landing.*`.
- Social preview 1200×630 PNG, under 300 KB, current palette, chair logo + "easy job", door or Floor. Replaces
  `landing.ogImage` (the current one is the old dark "compound boss" art).
- Logo sizes from `office/landing/brand/easy-chair.png` (580 KB, keep as source): 144px and 224px, under 40 KB each
  (`landing.brandMark144`, `landing.brandMark224`).
- Favicons: check `ui.favicon32` / `ui.appleTouch180` first; reuse if they show the chair logo, otherwise make
  `landing.favicon32` / `landing.appleTouch`.
- Do not delete the orphaned old landing art (hero, feature-*, wordmark, divider-wire, bg-tile); list it for the owner.

### T3 · Build the new pitch

Rewrite `landing/Pitch.tsx` (split into small components as needed: `Paper`, `NoticeBoard`, `Vignette`,
`OfficeRules`, `TimeCard`). Remove the old `.pitch-card` / `.pitch-points` styles. Vignettes draw sprite frames from
the sheets in the manifest (extend `scripts/build-landing.ts` to emit sheet paths, frame size and row numbers into
`art.generated.ts`; never hard-code frame numbers). CSS sprite steps or one small canvas per vignette; animate only
while on screen (IntersectionObserver), pause in hidden tabs. No Phaser in the pitch, no new dependencies.
`Install.tsx` keeps one source for the commands and the clipboard fallback; the dialog and the time card share it.

### T4 · Copy pass, whole landing

Reception, office heading, Projects binder, Conversation note, footer, pitch, install dialog, `index.html` title and
description. Remove every pattern in "What is generic now". Use the domain words from `CONTEXT.md` (Project, Agent,
Bench, Desk, Boss, Needs you, Seen, Nudge, Broadcast, HR bouncers). English, plain, at most one joke per block.
Keep the accessible names the check scripts use ("Clock in", "Return to reception", "Yes, run the tests",
"Looks good. Mark Seen", "Copy installation commands", "Make it your office") or update the scripts in the same commit.

### T5 · Wire assets and verify

`index.html`: favicon, apple-touch icon, `og:image` (+ width/height), `twitter:card=summary_large_image`, relative
paths that work under a GitHub Pages subpath. Logos use the 144/224 files. Then:

- `bun run check` passes.
- `bun scripts/build-landing.ts`, `bun scripts/preview-landing.ts`, then `node scripts/check-landing-layout.mjs` and
  `node scripts/check-landing-activity.mjs` pass. Add a check that the pitch has no horizontal overflow and that
  each vignette shows a still frame in Calm.
- Screenshots in `docs/review/landing-revamp-*`: reception, office, pitch, at 390, 1024, 1440, 2560, both themes,
  plus Calm. Log everything in `docs/progress-codex.md`. No push.
