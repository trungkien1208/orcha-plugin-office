# Easy Job

A local web app that shows your Orcha workspaces and agents as a pixel-art office (the Floor) and lets you run them
from the browser: chat first, the Floor for overview and play. Orcha (`~/Project/orcha`, a herdr fork) is the
engine; Easy Job is a client of its socket API. Domain words (Project, Agent, Bench, Boss, HR bouncers, Nudge, Bonk,
Broadcast, Seen…) are defined in `CONTEXT.md`: use them. Decisions: `docs/adr/` (read 0005 before anything about
packaging or merging with Orcha).

## Layout

- `packages/shared/`: types and pure helpers used by both sides (`OfficeState`, `Agent`, conversation items, stage and
  model helpers). Change a shape here first, then both sides in the same commit.
- `packages/bridge/`: Bun server on 127.0.0.1. Talks to Orcha over its socket, reconciles a versioned office state,
  serves the web build, the HTTP API and one WebSocket. Also the `easy-job` CLI. See `packages/bridge/CLAUDE.md`.
- `packages/web/`: React 19 + Vite app: shell (rail, chat, context panel, settings) and the Floor (Phaser 3) in
  `src/floor/`. See `packages/web/CLAUDE.md`.
- `packages/web/public/office/`: the art and `manifest.json` (owned by the art workflow, see below).
- `integrations/orcha-plugin/`: the Orcha plugin manifest (opt-in, see ADR 0005).
- `scripts/`: `check-assets.ts` (art checklist and review gate), `install-local.ts`, `smoke-live.ts` (manual, real Orcha).
- `e2e/`: Playwright checks against the fake Orcha.
- `docs/`: `PLAN.md` (original plan), `ROADMAP.md`, `PROGRESS.md`, `orcha-api-gaps.md`, `art-brief.md` +
  `asset-checklist.md` (art), task lists for the coding agents (`batch*.md`, `*-tasks.md`), plans (`plan-*.md`),
  `review/` (screenshots), `art-review/` (contact sheets, `approved.json`).

## Cross-cutting contracts

- **Never modify Orcha** from this repo. A missing capability goes in `docs/orcha-api-gaps.md`; Orcha-side work is
  planned separately (the Owner's fork). Orcha-specific code lives only in `packages/bridge/src/orcha/` and
  `state/reconcile.ts`; socket code only in `orcha/transport.ts` (Windows named pipes come later).
- **Local only**: bind 127.0.0.1, per-run token (persisted in `~/.easy-job/token`, 0600), Host/Origin checks, no
  telemetry, no outbound requests at runtime (fonts and art are bundled).
- **Untrusted agent output**: transcripts, terminal text and agent names are text, never HTML. Markdown renders
  through react-markdown without raw HTML.
- **No secrets**: never read, return or log tokens; never touch the macOS Keychain (account switching by Keychain
  needs Orcha's account API, see `docs/plan-accounts-team.md`).
- **Destructive actions confirm**: removing an Agent, closing a Project (typed name), anything that stops work.
  Work actions from the Floor go through the bridge; gags (buzzer, zap, coffee, high-five) never reach Orcha.
- **Merge-ready (ADR 0005)**: no app store or API imports inside `packages/web/src/floor/` (it takes `FloorInput`
  props only); art and manifest travel with the Floor.
- **Themes**: Compound (default) and Cozy Office. Office art comes from `manifest.themes.office` by the same
  group/key as the Compound file it replaces; office-only keys exist only there. Calm mode: no motion, no fire, no
  gags, no sound. Every UI change works in both themes and in calm mode.
- **Art vs code**: images and `manifest.json` come from the art workflow (Codex, rules in `docs/art-brief.md`, list
  in `docs/asset-checklist.md`). Code reads the manifest and never redraws art. A file only counts once a human
  approved it (`bun scripts/check-assets.ts --approve <path>` records its hash); placeholders of the right size are
  rejected. CSS that names art paths (`looks.css`) must follow renames.

## Working with the coding agents

Claude plans and reviews; Cursor owns the backend (`packages/bridge`, `packages/shared`, `scripts`); Codex owns
the UI and art (`packages/web`). Each works in its own worktree and branch (`../PartyAgent-2-be` on `be/…`,
`../PartyAgent-2-ui` on `ui/…`), logs progress in `docs/progress-cursor.md` / `docs/progress-codex.md`, one commit
per task, no push. Features that need both start with a written contract (types + routes, like `docs/batch1.md`);
the UI falls back gracefully until the backend is merged. Claude merges backend first, then the UI rebases.
Small batches (3–5 tasks) with a review between them work better than long lists.

## Branches

`build/orcha-office` is the working branch; `main` is the PR base. `origin` is the private `orcha-plugin-office-dev`
(full history); the public `orcha-plugin-office` only gets clean snapshots from `scripts/publish-public.ts`, whose
denylist (`scripts/publish-denylist.txt`, never published) blocks real project names and paths. Agent branches (`be/*`, `ui/*`) merge into
`build/orcha-office` after review. Commit or push only when the Owner asks; never push from an agent worktree.

## Done means

`bun run check` passes (tsc, Biome, `bun test packages`); `bun run test:e2e` for flows it covers. For UI changes,
look at it in a browser on `bun run dev:fake` (both themes, 1440×900 and 1024×700; no horizontal scroll, nothing
overlapping) and save screenshots under `docs/review/` when a task asks. For bridge changes that touch Orcha calls,
also run `scripts/smoke-live.ts` against a scratch workspace when the Owner agrees. Commit messages follow
Conventional Commits (`feat(floor): …`, `fix(bridge): …`) and end with the attribution line the session gives.
