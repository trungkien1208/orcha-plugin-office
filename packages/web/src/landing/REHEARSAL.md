# ProductDemo rehearsal

- **Gold copied:** `hero-demo` (Stageshow): a window inset top-left with a terminal satellite, named
  targets, a five-beat cursor story. Layout: corner bleed with the window's foot faded (`fade-crop`).
- **Story (about 10 s):** Pixel raises a hand and Orcha's pane asks; the cursor clicks Pixel; the chat swaps
  to Pixel's question; the cursor clicks Yes; the hand drops, the pill turns Working, the reply and the pane's
  "running 128 tests" arrive; hold; back to the first frame.
- **Poster:** the answered state (reply shown, pane running), used under reduced motion.
- **Changed from the gold:** Easy Job's own Floor drawn from the native sprite sheets (`BenchCanvas`),
  a chat column instead of a dashboard, an Orcha terminal instead of Claude Code, Chakra/Plex fonts,
  rust accent. Compact (358 wide): Bench at 1x over the chat, no satellite, no fade.
- **Checked:** `node scripts/check-landing.mjs` at 390, 1024, 1440, 2560 (story reaches the answer, poster
  under reduced motion, no overflow, one screen on desktop); stills reviewed at each beat.
- **Not checked:** `film.mjs --gate` from the skill (it needs the skill's own preview server); dark theme
  (the page has none); the loop seam frame by frame.
