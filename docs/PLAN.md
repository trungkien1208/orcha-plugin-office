# Easy Job: implementation plan

This plan is for the coding agent (Cursor) that builds Easy Job. Work phase by phase: finish a phase, run its acceptance checks, record them in `docs/PROGRESS.md`, commit, then continue (the user asked for one autonomous run). **Section 5 (review additions) amends the phases below; where they disagree, section 5 wins.**

## 0. Read first

| What | Where |
|---|---|
| Domain language (use these words in code, UI and commits) | `CONTEXT.md` |
| Decisions already made, do not reopen | `docs/adr/0001`–`0004` |
| Visual spec: screens, floor, states, tokens | `docs/style/style-guide.html` (open it in a browser) |
| Art the code must load | `docs/art-brief.md` |
| Orcha socket API (methods, events, **recovery rules**) | `~/Project/orcha/docs/next/website/src/content/docs/socket-api.mdx` |
| Orcha API schema | `~/Project/orcha/docs/next/api/herdr-api.schema.json` (also `orcha api schema --json`) |
| Orcha agents, session state | `…/docs/agents.mdx`, `…/docs/session-state.mdx`, `…/docs/concepts.mdx` |
| Engine to borrow (Phaser office) | `~/Project/agent-fleet/dashboard/` (read its `CLAUDE.md` and `src/CLAUDE.md` first) |

## 1. Ground rules

- **Local only.** Bind `127.0.0.1`. No telemetry, no CDN, no network request at runtime other than localhost. Fonts ship as npm packages.
- **Never modify Orcha.** Anything missing from its API goes into `docs/orcha-api-gaps.md`.
- **Agent output is untrusted text.** Never render it as HTML. No `dangerouslySetInnerHTML` anywhere. Markdown is rendered with `react-markdown` without raw HTML.
- **Per-run token** (ADR 0002). Every REST and WebSocket request must carry it; check `Host` and `Origin`; no CORS.
- **Art comes from the manifest** (`packages/web/public/office/manifest.json`). Never hard-code an art path. When a manifest key is missing, draw the code placeholder (Phase 3).
- **UI copy is English.** The product name is **Easy Job** (header: "EASY JOB · Orcha").
- **Scope.** Build only what this plan says. Ideas in `docs/ROADMAP.md` are out of scope for v1.
- **Done for any phase** = `bun run check` passes (typecheck + lint + tests) and the phase's acceptance list is verified by hand.
- Keep files small and named after what they do. A `.tsx` file exports components only.

## 2. Facts about Orcha already verified on this machine

- Orcha 0.9.12 (herdr 0.9.5), protocol 22. Socket is **`~/.config/orcha/herdr.sock`**, not `~/.config/herdr/herdr.sock`. Inside an Orcha pane `HERDR_SOCKET_PATH` is set.
- Socket resolution order: `EASY_JOB_SOCKET` (our override) → `HERDR_SOCKET_PATH` → `~/.config/orcha/herdr.sock` → `~/.config/herdr/herdr.sock`. Optional `--session <name>` → `~/.config/orcha/sessions/<name>/herdr.sock` (fall back to the herdr path).
- Transport: newline-delimited JSON. Request `{"id","method","params"}`; response has the same `id` and either `result` or `error {code,message}`.
- `session.snapshot` → `result.snapshot` with `workspaces`, `tabs`, `panes`, `agents`, `layouts`, `focused_*_id`, `version`, `protocol`. Workspace ids look like `w1`, `wQ`; pane ids like `w2:p1`.
- Agent status enum: `idle | working | blocked | done | unknown`. `done` = idle and not yet seen in Orcha.
- Agent records carry `agent` (kind), `display_agent`, `name`, `cwd`, `tokens` (`task`, `stage`, `model`), `terminal_title_stripped`, `completion_seq`, `state_change_seq`, `agent_session {source, agent, kind, value}`, `interactive_ready`, `launch_pending`.
- 16 workspaces and about 21 panes; 7–9 Agents (claude, codex, cursor), the rest are plain shells (**Terminals**). Counts change all the time: never hard-code them.
- `events.subscribe`: `pane.agent_status_changed` **requires `pane_id`** (no wildcard). One unknown pane id makes Orcha reject the whole request and close the connection (ADR 0003). Lifecycle events (`workspace.*`, `tab.*`, `pane.created/closed/updated/moved/exited/agent_detected`, `layout.updated`) need no ids.
- `agent.start` needs an existing `pane_id` plus `name` and `kind`. To start an Agent in a Project: `tab.create` in that workspace (no focus), then `agent.start` on the new pane.
- `agent.prompt` returns error `agent_blocked` when the Agent is blocked (nothing is sent).
- Transcripts: Claude Code writes `~/.claude/projects/<cwd-slug>/<session>.jsonl` (slug: cwd with `/` and `.` replaced by `-`, e.g. `-Users-sam-Project-acme-superapp`). Codex writes `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<session>.jsonl`. `<session>` = `agent_session.value`.
- Orcha's sounds: `~/.config/herdr/sounds/done.mp3`, `request.mp3`.

**Before writing parsers or the reconciler, capture real data** (Phase 1 step 1). Shapes not listed above (event envelopes, the subscription ack) must be read from captured lines, not guessed.

## 3. Repository layout

```
package.json            bun workspaces, scripts: dev, start, check, test
CONTEXT.md  docs/
packages/
  shared/src/           types shared by bridge and web (no runtime deps)
    orcha.ts            Orcha wire types (subset of the schema we use)
    office.ts           OfficeState, Agent, Project, Status, Activity, WS messages, REST payloads
  bridge/src/
    main.ts             CLI entry: flags, starts Orcha link + HTTP server, opens browser
    orcha/transport.ts  socket path resolution + NDJSON connection (Windows named pipe later, only here)
    orcha/client.ts     request/response client (ids, timeouts, errors)
    orcha/link.ts       subscription + snapshot lifecycle, recovery, reconnect
    state/reconcile.ts  pure: snapshot (+ local facts) → OfficeState
    state/local.ts      Seen marks, waiting-since times, skins, layout memory (persisted)
    state/activity.ts   Activity log (persisted JSONL, 7 days)
    conversation/claude.ts   Claude transcript parser
    conversation/codex.ts    Codex transcript parser
    conversation/terminal.ts fallback: agent.read text
    conversation/watch.ts    locate + tail transcript files, push new items
    actions.ts          every control action (prompt, keys, answer, start, rename, focus, broadcast…)
    skills.ts           list skills / slash commands for an Agent's cwd
    uploads.ts          save attachments under ~/.easy-job/uploads
    http/server.ts      Bun.serve: static, REST, WebSocket, token + Host/Origin checks
    http/routes.ts      REST handlers (zod-validated)
  bridge/test/          bun test + fixtures/
  web/
    index.html  vite.config.ts
    public/office/      manifest.json + art from Codex (placeholder manifest until then)
    src/
      main.tsx  App.tsx  store.ts  api.ts  theme.css
      home/             Home screen (floor left, manager panel right)
      conversation/     Conversation screen
      chat/             message list, tool lines, question card, composer, attachments, slash menu
      floor/            Phaser floor (Phase 3)
      ui/               shared small components
```

## 4. Stack

Bun (≥1.4), TypeScript strict, React 19, Vite, Phaser 3, zod, react-markdown + remark-gfm, `@fontsource/chakra-petch` (display), `@fontsource/ibm-plex-sans` (body), `@fontsource/jetbrains-mono` (terminal/ids), `pathfinding` (as in the fleet), `strip-ansi`. Lint with oxlint or biome (pick one). Pin exact versions in `bun.lock`.

## 5. Review additions (2026-10-30, after Phase 1)

Read this before continuing Phase 2. Items marked **[P1 fix]** change code that Phase 1 already committed.

### Identity and layout

1. **[P1 fix] Stable agent identity.** Orcha gives a pane a *new* `pane_id` when it moves to another workspace (`pane.moved`), and pane ids are reused after a pane closes. Key everything we remember about an Agent (Skin, Seat, Seen mark, waiting-since, Activity) by `agentKey = agent_session.value ?? terminal_id ?? pane_id`, not by `pane_id`. `pane_id` stays the address for API calls. Add a reconciler test for a moved pane keeping its Skin and Seen mark.
2. **[P1 fix] Skins come from the manifest cast.** Bridge reads `packages/web/public/office/manifest.json` at start (and on change) and uses `characters.cast` (16 ids: 8 humans + 8 robots/animals) for `CAST[hash(agentKey) % CAST.length]`; fall back to a built-in list of the same 16 ids if the manifest is missing. Every other id in `characters.skins` is only selectable in the Skin picker.
3. **Bench order and team numbers.** Order and team numbers are set when the page loads (Orcha order, compacted). While the page is open: new Benches go to the end, nothing moves, nothing renumbers; a workspace moved in Orcha is reflected on the next reload. **Closing a workspace burns its Bench** (item 17) and leaves a scorched gap until reload. Benches never grow past 4 seats (item 16).
4. **Frame rows come from the manifest.** Worker sheets are now 9 rows (row 9 = zapped), the Boss sheet 10 rows. Read `characters.frame.rows` and `characters.bossRows`; never assume 8. A sheet with fewer rows than an action needs falls back to the nearest frame (e.g. no zapped row → use the stand-up frame) instead of crashing.

16. **Max 4 seats per Bench, append-only Floor (decided 2026-10-30; replaces "a Bench grows by 2" and "Benches slide").** Every Bench has exactly 4 seats. **While the page is open, no Bench ever moves.** A new Project, and a Project's extra Bench when it passes 4 Agents, both take the **next free slot at the end** of the Floor (left column, right column, next row). Tags: one Bench → `TEAM 02 · acme-superapp`; several → `TEAM 02 · acme-superapp_1`, `…_2` (one team number per Project, same colour); a painted floor line in Project colour links a Project's Benches. New Agents take the first free seat in `_1`, then `_2`…; seated Agents keep their seat. Extra Benches stay until reload. **On reload the Floor is compacted**: Projects in Orcha order, a Project's Benches side by side, gaps removed, team numbers renumbered. Unit tests: 4→5 Agents puts `_2` in the last slot and moves nothing; a closed Project leaves a gap; reload compacts.

17. **Leaving and closing animations (decided 2026-10-30).**
    - **An Agent ends** (pane closed or agent gone): two **HR bouncers** (black polo, "HR" badge, big build) walk in from the door along the path, grab the worker under the arms, carry it (worker in the `carried` frames, legs dangling) back to the door and toss it out: dust poof, the empty chair spins. Seat is free when they pick it up. Cartoon only, no hitting. If several Agents end at once, bouncer pairs queue (max 2 pairs on the floor).
    - **A Project closes**: bouncers first remove any seated Agents (as above), then the Bench catches **cartoon fire** (~2 s, flames over the desk, smoke), collapses to an **ash pile and scorch mark** that stays in that slot until reload. Its tag turns grey and reads `TEAM 05 · name (closed)`. A short crackle sound; respects mute and reduced motion (reduced motion: no flames, the Bench fades to the scorch mark).
    - Walking always uses the path grid (item 18).
18. **No walking through things.** Characters (workers, bouncers, Boss) move only along the pathfinding grid: walls, Benches, chairs, props and the boss office are blocked; aisles and the space behind chairs are walkable; a worker reaches its chair from behind. Rebuild the grid when a Bench appears or burns. Test: every path returned avoids blocked tiles; in the demo, record a walk and assert no sprite foot position lands on a blocked tile.

### Conversation and Questions

5. **Question buttons come from the Question.** Do not hard-code Yes / Always / No. Parse the Question text from `agent.read source=detection`: numbered options (`❯ 1. Yes`, `2. …`) become one button per option that sends that digit; a `(y/n)` prompt becomes `y` / `n`; always add `Enter` and `Esc`. Unknown shapes show only `Enter`, `Esc` and the free-text answer. Unit test with real Claude, Codex and Cursor prompts captured into fixtures.
6. **Cursor Agents.** Today's Orcha has `cursor` Agents. Look for Cursor CLI transcripts on disk (e.g. under `~/.cursor/`); if a stable JSONL format exists for the session id, add `conversation/cursor.ts` with fixtures; otherwise Cursor uses the terminal fallback. Record the finding in `docs/orcha-api-gaps.md` or PROGRESS.
7. **Big transcripts.** Session files reach many MB. On open, read only the tail (last ~256 KB, then whole lines) and page backwards in chunks for `?before=`. Never load a whole file into memory.
8. **Transcripts are private.** They can contain secrets. Serve them only over the token-checked API, never write their text to Activity or logs (Activity stores only the Observer's own prompts, truncated).

### Running the bridge

9. **Single instance.** On start, write `~/.easy-job/bridge.json` `{pid, port, token}` with mode `0600` (dir `0700`). If a live bridge is already running, `bun start` just opens the browser on it instead of starting a second one. Remove the file on clean exit.
10. **Protocol check.** On connect call `ping` (and read `protocol` from the snapshot). If the protocol is not 22, keep working but show a yellow banner "Orcha protocol N is untested; some actions may fail".
11. **`--no-open` and `--port`** flags; uploads older than 7 days are deleted on start.

### Testing without touching real agents

12. **Fake Orcha.** Add `packages/bridge/test/fake-orcha.ts`: a small NDJSON socket server that serves the recorded snapshot, replays recorded events on a timer, and accepts every action method we call (recording them). Use it in integration tests (link recovery, status-subscription rebuild, every REST action → expected Orcha method and params) and expose it as `bun run dev:fake` so the UI can be built and demoed with sample Agents (including a Needs-me one) without touching the user's real sessions. Phase 2 and 3 hand-testing of actions happens against the fake first, then once against a throwaway real Agent.
13. **One browser smoke test** (Playwright, against `dev:fake`): load with token, see Projects, open an Agent, answer a Question, send a Prompt, start a new Agent. Without the token the page shows the "open from the terminal" state.

### Signals and the floor

14. **Sound unlock and gong rate.** Browsers block audio until a user gesture: show a small "🔇 Click to enable sound" chip until the first click. The gong and `done.mp3` play at most once per 2 seconds even if several Agents finish together; `request.mp3` likewise.
15. **KPI "Done today"** is counted from Activity (transitions into Done since local midnight, per Project), so it survives a page reload. Show the top 5 teams.

## 6. Infrastructure and sync (2026-10-30)

### What runs where

```
 this Mac only ───────────────────────────────────────────────────────────────
  Orcha server ──unix socket (NDJSON)──▶ Bridge (Bun, 1 per machine) ──HTTP + WS on 127.0.0.1──▶ browser tab(s)
       ▲                                    │  ▲
       │ agent.prompt / send_keys / …       │  └─ reads ~/.claude/projects/**, ~/.codex/sessions/** (transcripts)
       └────────────────────────────────────┘     writes ~/.easy-job/ (state, activity, uploads, logs, bridge.json)
```

- **No server, no database, no cloud.** Three local processes: Orcha (already running), the bridge, and the browser.
- **Data dir** `~/.easy-job/` (mode `0700`): `bridge.json` (pid, port, token; `0600`), `state.json` (Seen marks, skins, floor memory, settings), `activity.jsonl`, `uploads/`, `logs/bridge.log` (rotate at 5 MB, keep 3; never log transcript text or prompt bodies).
- **Start**: `bun start` (foreground). Optional in Phase 4: `bun run autostart on|off` installs/removes a macOS LaunchAgent so the bridge runs at login (no browser opened). Windows later: only `orcha/transport.ts` changes (named pipe).
- **Out of scope for v1**: access from another device (phone, LAN). The bridge binds `127.0.0.1` only. Write that in the README as a non-goal; a later version could use Tailscale with its own auth.

### Who owns which truth

| Data | Owner | Others hold |
|---|---|---|
| Projects, Agents, Status, names, tasks | **Orcha** | bridge cache (refreshed from snapshots), web copy |
| Conversation | **the agent's transcript file** (or Orcha terminal text) | bridge tails it, web shows a window of it |
| Seen marks, Skins, floor memory, Activity, settings | **bridge** (`~/.easy-job/`) | web copy |
| Selection, open tab, scroll, drafts, mute | **each browser tab** | nobody |

The web never decides state on its own; it renders what the bridge sends.

### Orcha → bridge (already built in Phase 1, keep it)

Events are invalidations; a debounced (150 ms), serialized `session.snapshot` refresh is the truth; `pane.agent_status_changed` may be applied at once as a hint. `events_lost`, socket close or Orcha down → reconnect with backoff (0.5 s → 5 s) and full re-snapshot.

Add:
- **Watchdog.** If no event and no successful refresh for 30 s, do a quiet `session.snapshot` anyway (catches a silently dead socket after sleep/wake). If that fails, reconnect.
- **Orcha restart / upgrade.** After a reconnect, panes may have new ids; identity uses `agentKey` (section 5 item 1), so Skins, Seats and Seen marks survive.

### Bridge → web

- **Versioned full state.** On WebSocket connect the bridge sends `hello {bridgeId, serverTime, version}` then `state {version, state}`. Every change sends the whole `OfficeState` again with `version + 1`, throttled to 10/s. The web drops any message with a version ≤ the one it has. Full state is small (tens of KB); if it ever passes ~200 KB, switch to JSON patches, not before.
- **Heartbeat.** Server pings every 15 s; the web treats 35 s of silence as disconnected and reconnects (backoff 0.5 s → 5 s). On reconnect it gets `hello` + full state again; if `bridgeId` changed, the bridge restarted: refetch everything (conversations, activity).
- **Token survives bridge restarts.** Reuse the token from `bridge.json` while that file exists, so open tabs keep working after `bun start` again. `bun start --new-token` rotates it (old tabs then show "Reopen Easy Job from the terminal").
- **Denied is not connecting.** `GET /api/health` needs no token and returns only `{ bridge: true, orcha: boolean, protocolWarning?: string }` (still checked for Host and Origin). A missing or wrong token on any other HTTP route is `401 { error: "bad_token" }`. A WebSocket without `Sec-WebSocket-Protocol: easy-job.<token>` is accepted and then closed with code `4401` and reason `bad_token`, so the gate can tell "denied" from "still connecting".
- **Conversation sync.** Items carry stable ids (Claude/Codex line `uuid`, else file byte offset). The web keeps the last id per watched Agent; on reconnect it asks `GET …/conversation?after=<id>` and merges by id, so nothing is duplicated or lost.
- **Clock.** Waiting times are computed from bridge timestamps; the web corrects with `serverTime` from `hello`.

### Web → Orcha (actions)

- REST → bridge → Orcha method → HTTP response with Orcha's result or error. The response means "Orcha accepted it", not "the agent did it".
- **Pending, not optimistic.** After an action the Agent shows a small "sent…" marker. The marker clears when the state shows the effect (e.g. Needs me → working after an Answer) or after 10 s with "No change seen yet". Never fake a status change in the UI.
- **Per-agent queue.** The bridge runs actions for the same Agent one after another (an Answer's text + Enter must not interleave with another tab's keys). Different Agents run in parallel.
- **Typing in Orcha at the same time** cannot be locked out; that is accepted and noted in the README.

### Changes made in Orcha directly

Everything done in Orcha's own UI (typing, rename, closing a pane or workspace, moving panes, viewing a Done agent) arrives as events → snapshot → new state version → all tabs. Viewing a Done agent in Orcha turns it idle in Orcha, so the office follows automatically.

### Several browser tabs

All tabs get the same state. Only one tab plays sounds and shows Notifications: elect a leader with `BroadcastChannel` (the most recently focused visible tab wins; hand over on close). Title badge shows in every tab.

### What the user sees when sync breaks

Header connection dot: **green** live · **amber** "Reconnecting… data may be out of date" (bridge unreachable; state greyed, actions disabled) · **grey** "Orcha isn't running" (bridge up, Orcha down; last known floor greyed, actions disabled, shows the socket path). Recovery needs no reload.

### Acceptance (add to Phase 2 and run again in Phase 4)

- Stop the bridge with a tab open → amber state; start it again → tab recovers without reload, same token.
- Two tabs open: a Needs-me plays one sound, not two; an action in one tab shows in the other.
- Answer an Agent → "sent…" marker → clears when its status changes.
- Simulate sleep: kill the Orcha socket connection from the bridge side (test hook) → watchdog reconnects within 35 s.
- Rename an agent in Orcha's own UI → name updates in the web within ~1 s.

## 7. Install and run (2026-10-30)

### One command: `easy-job`

Easy Job ships as **one executable** (`bun build --compile`, with the built web app and `public/office/` art embedded), installed next to `orcha` in `~/.local/bin/easy-job`. Users don't need Bun installed. Developers still use `bun run dev` / `bun start` in the repo.

| Command | Does |
|---|---|
| `easy-job` | Start the bridge if none is running (section 5 item 9), then open the browser. If one is running, just open the browser. |
| `easy-job serve [--no-open] [--port N] [--session NAME]` | Run the bridge in the foreground (used by the Orcha plugin pane and the LaunchAgent). |
| `easy-job open` | Open the browser on the running bridge (start one in the background first if needed). |
| `easy-job stop` / `easy-job status` | Stop the running bridge / print pid, port, Orcha connection, protocol, counts. |
| `easy-job doctor` | Check and explain, with the fix for each: Orcha installed? server running? socket path, protocol, transcripts dirs, data dir permissions, port free, art manifest valid. |
| `easy-job autostart on\|off` | Install/remove a macOS LaunchAgent that runs `easy-job serve --no-open` at login. |
| `easy-job orcha-plugin install\|uninstall` | Link/unlink the Orcha plugin below (`orcha plugin link <path>`). |

### Installer

`install.sh` (repo root, later published): copies the binary to `~/.local/bin`, creates `~/.easy-job/` (`0700`), then:
- if `orcha` is missing → explain that Easy Job needs Orcha and **ask** (default No) before running Orcha's own installer (`curl -fsSL https://raw.githubusercontent.com/trungkien1208/orcha/HEAD/install.sh | sh`); never install silently;
- **ask** whether to install the Orcha plugin and whether to start at login;
- finish by running `easy-job doctor`.

For v1 on this machine: `bun run install-local` builds the binary and does the same steps without downloading anything.

### Inside Orcha: the plugin

`integrations/orcha-plugin/herdr-plugin.toml`:

```toml
id = "easy-job"
name = "Easy Job"
version = "0.1.0"
min_herdr_version = "0.9.0"
description = "Open the Easy Job office for your agents"
platforms = ["macos", "linux"]

[[actions]]
id = "open"
title = "Open Easy Job"
command = ["easy-job", "open", "--via-orcha"]

[[panes]]
id = "server"
title = "Easy Job"
placement = "tab"
command = ["easy-job", "serve", "--no-open"]
```

- **Open from Orcha**: command palette "Open Easy Job", or bind a key in Orcha's config (the installer prints this snippet, it does not edit the user's config):
  ```toml
  [[keys.command]]
  key = "prefix+j"
  type = "plugin_action"
  command = "easy-job.open"
  description = "open Easy Job"
  ```
- `open --via-orcha`: if no bridge is running, create (once) a workspace labelled `Easy Job` with `focus: false`, open the plugin's `server` pane there (`plugin.pane.open`, placement `tab`, `focus: false`), wait for `bridge.json`, then open the browser. The bridge then lives as an Orcha-managed pane: it stops with Orcha's server and shows its log there.
- **The bridge hides itself**: it knows its own `HERDR_PANE_ID`; that pane and the `Easy Job` workspace (when it holds nothing else) never appear on the Floor or in counts.
- No startup hook in v1 (hooks are one-shot and must not leave daemons). Users who want Easy Job always on use `easy-job autostart on`.

### Situations

| Situation | What the user does | What happens |
|---|---|---|
| Orcha installed and running | `easy-job` (or `prefix+j` in Orcha) | Bridge starts (or is reused), browser opens on Home. |
| Orcha installed, not running | `easy-job` | Browser opens on the grey "Orcha isn't running" screen with **Start Orcha** (runs `orcha server` detached, after a confirm) and the hint "or just type `orcha` in a terminal". The floor fills in as soon as the socket appears. |
| Neither installed | run `install.sh` | Installer offers to install Orcha first (asks), then Easy Job, then runs `doctor`. Next step printed: "type `orcha`, sign in to your agents, then `easy-job`". |
| Easy Job already open in a tab | `easy-job` again | No second bridge; the existing tab is reused or a new tab opens on the same bridge. |
| Orcha restarts or updates | nothing | Bridge shows amber/grey, reconnects, Seats and Skins survive (`agentKey`). With the plugin pane, the bridge restarts with Orcha's next `prefix+j`. |
| A named Orcha session | `easy-job --session demo` | Bridge watches that session's socket; the header shows the session name. |

### Acceptance (Phase 4)

- `bun run install-local` then `easy-job doctor` passes on this machine; `easy-job` opens the office; `easy-job` again does not start a second bridge.
- With the plugin installed: "Open Easy Job" from Orcha's command palette starts the bridge in an `Easy Job` tab without moving the user's focus, opens the browser, and that pane/workspace do not show on the Floor.
- Stop Orcha's server: the web shows the grey screen; **Start Orcha** brings it back and the floor refills.
- `easy-job autostart on` → log out/in (or `launchctl kickstart`) → bridge running; `off` removes it.

## 8. Work split for the remaining work (2026-10-30)

Phases 1–4 are committed (`f039cfd`) but sections 5–7, the rename and most of the Phase 3 floor are not done. Two agents now work in parallel, split by directory so they never edit the same file.

| Owner | Owns (only edits these) | Work |
|---|---|---|
| **Cursor** (main worktree, branch `build/orcha-office`) | `packages/bridge/**`, `packages/shared/**`, `packages/web/src/**` **except** `floor/`, root config, `integrations/**`, `README.md`, `docs/PROGRESS.md` | Rename to Easy Job; section 5 (items 1–2 in progress, then 5–15); section 6; section 7; fake Orcha + `dev:fake` + Playwright smoke test; browser pass of every non-floor acceptance item |
| **Codex** (worktree `../PartyAgent-2-floor`, branch `build/floor` from `f039cfd`) | `packages/web/src/floor/**`, `packages/web/public/office/**`, `docs/art-review/**`, `docs/FLOOR-PROGRESS.md` | Finish the Phase 3 floor with the real art (list below) |

**Contract between them.** The floor gets everything through `FloorView`'s props (OfficeState, selection, settings) and reports through callbacks (`onSelectAgent`, `onSelectProject`, `onAction(kind, agentKey|projectId, payload)`). If the floor needs a new field or callback, Codex writes it under "Requests to Cursor" in `docs/FLOOR-PROGRESS.md` and uses a local stub meanwhile; Cursor adds it to `shared/` and the web shell. Neither edits the other's files.

**Merge.** When Codex's floor checklist is done and its tests are green, Cursor merges `build/floor` into `build/orcha-office` (Cursor resolves conflicts, Codex's floor files win inside `floor/`), runs `bun run check` and the Phase 3 acceptance list in a browser with `dev:fake`.

### Codex's floor checklist

1. Draw from the real art in the manifest: bench segments (`bench-l/m/r`), monitors with the code-painted screen rect, chairs front/back, phone racks, bench tags (tinted face + crisp `TEAM 02 · name` text), character sheets with the `-polo` layer tinted by Project colour, portraits for the panel (export a small helper the web shell can import). Placeholders stay as fallback per key.
2. Read frame rows from `characters.frame.rows` / `bossRows`; nearest-frame fallback.
3. Full front wall and props: banner text, KPI board from state (top 5 teams by Done today, red flower on #1), recruitment poster text, live clock, CCTV blink, night windows flicker, gong (strike frames + `done.mp3`, max once per 2 s), noodle cartons and drink crates, dorm door, boss office at the bottom.
4. Status visuals exactly as style guide §2 (screen colours, poses hand↑/relax↑/nap↑/type↑, bubbles, gold marker, gold blinking Bench outline).
5. Life cycle (section 5 items 16–18): append-only Benches, new Agent walks the path grid from the door to its Desk and sits; ended Agent carried out by two HR bouncers; closed Project's Bench burns to a scorch mark; nobody walks through objects.
6. Camera: drag to pan, wheel/pinch zoom in integer steps, semantic zoom (far = tags + status dots), pan to the selected Agent and pulse it.
7. Boss: all actions animated with the boss rows and fx sprites; worker reactions (jump, zapped row 9, stars). Work actions (tap, knock, bonk with confirm, megaphone) call `onAction`; fun actions (buzzer, whip crack, zap, coffee, high-five) play animation + sound only and never call `onAction`.
8. Keyboard: WASD/arrows, `n` next Needs-me, `Esc`; focus handling per the fleet's gotchas; `prefers-reduced-motion`.
9. Pure unit tests for: action availability by status (work vs fun), proximity, frame lookup with fallback, KPI ranking, team numbering after a workspace closes.
10. A `?demo` mode in the floor (sample state, all five statuses, buttons: add Agents to a Project so a `_2` Bench appears at the end, end an Agent (bouncers), close a Project (fire)) so it can be checked in a browser without the bridge; screenshot it into `docs/art-review/floor-*.png`.

## Phase 1: Bridge core (no web yet)

Goal: a process that stays connected to Orcha, keeps a correct `OfficeState`, and prints it.

1. **Capture fixtures first** (`packages/bridge/test/fixtures/`):
   - `orcha api snapshot > snapshot-live.json`.
   - A small script `scripts/record-events.ts` that subscribes to all lifecycle events plus `pane.agent_status_changed` for every current pane, and writes raw lines to `events-*.ndjson` for a few minutes while you start, prompt, block and stop an agent in Orcha.
   - Record one `events_lost`-style error and one rejected subscription (subscribe with a non-existent pane id) so their exact shapes are known.
   - Redact nothing structural; replace prompt text with placeholders if it is private.
2. `transport.ts`: `resolveSocketPath(opts)`, `connect(path)` returning an object with `send(obj)`, an async iterator of parsed lines, and `close()`. Lines that fail to parse are logged and skipped.
3. `client.ts`: `request(method, params, {timeoutMs=10000})` → result or typed `OrchaError {code, message}`. One request connection, reconnects on demand.
4. `link.ts`, following the recovery rules in `socket-api.mdx` **exactly**:
   - Open the lifecycle subscription, wait for its acknowledgement, keep reading.
   - On another connection call `session.snapshot`; replace the cache.
   - Open a **status subscription** listing `pane.agent_status_changed` for every current pane id.
   - Treat every event as an invalidation: schedule a snapshot refresh (debounce ~150ms). Serialize refreshes; if events arrive while a refresh is in flight, refresh again after it finishes.
   - For `pane.agent_status_changed` you may apply the new status immediately for snappy UI, but the following snapshot is the truth.
   - When the set of pane ids changes: open a new status subscription from the latest snapshot, then close the old one. If Orcha rejects it (a pane vanished), refresh and retry.
   - On `events_lost`, connection close, or Orcha not running: mark `orcha.connected=false`, back off (0.5s → 1s → 2s … max 5s), and start over from step one.
5. `reconcile.ts` (pure, fully unit tested): `(snapshot, local, now) → OfficeState`:
   - **Projects**: one per workspace, in Orcha order (`number`), label with Nerd Font glyphs stripped (Private Use Area U+E000–U+F8FF and supplementary planes) and trimmed; `projectColor = hsl(hash(label) 60% 58%)` (same hash as the style guide); `terminalCount` = panes in the workspace without an agent.
   - **Agents**: one per agent record. `status` = Orcha status, except a `done` Agent whose `completion_seq` ≤ the local Seen mark shows `idle`. `name` = Orcha `name`, else the Skin's name. `task` = `tokens.task` ?? `terminal_title_stripped`. `stage`, `model` from tokens. `waitingSince` for `blocked` (first time seen blocked, kept until it leaves blocked). `skin` = local override ?? `CAST[hash(pane_id) % CAST.length]`. `CAST` = the manifest's `characters.cast` (16 ids: 8 humans + 8 robots/animals); every other skin in `characters.skins` is selectable in the Skin picker but never picked by default.
   - **Counts**: needs-me, done, working, projects.
   - Sort helper used everywhere: needs-me → done → working → idle → unknown, then longest waiting first.
6. `local.ts`: persists to `~/.easy-job/state.json`: Seen marks `{pane_id: completion_seq}`, skin overrides, first-seen times, and the floor memory (bench sizes, seat per pane id) so seats don't jump on restart. Write atomically.
7. `activity.ts`: append status transitions and Observer actions to `~/.easy-job/activity.jsonl` (prompts truncated to 200 chars), drop entries older than 7 days on start.
8. `main.ts --print`: print the Projects/Agents table once, then one line per status change (`10:42 acme-superapp · Headset → needs me`). Print "Orcha isn't running, waiting…" instead of crashing.
9. Keep `docs/orcha-api-gaps.md` up to date (it already lists: no wildcard status subscription; no way to mark an Agent seen without moving the user's Orcha focus; `agent.start` needs an existing pane; no structured conversation). Add anything else you hit.

Tests (with the recorded fixtures): snapshot → state mapping; label glyph stripping; done vs Seen; waitingSince kept across refreshes; pane created/closed changes the status-subscription set; `events_lost` → full refresh; rejected status subscription → retry; sorting.

**Acceptance**
- `bun run bridge -- --print` shows the live Projects and Agents and prints live status changes while you use Orcha.
- Quit Orcha: bridge prints the waiting message; start Orcha: it reconnects by itself.
- Open and close a pane in Orcha: no crash, status still updates for the new pane.
- `bun run check` passes.

## Phase 2: Server, web shell, lists and Conversation

Goal: the full control surface in the browser, with a plain list where the floor will go.

### Server (`http/`)

- `Bun.serve` on `127.0.0.1:4317` (next free port if busy). Generate a 32-byte token per run; open `http://127.0.0.1:<port>/#t=<token>`. Web stores it in `sessionStorage` and removes it from the URL.
- Reject requests without `Authorization: Bearer <token>` (WebSocket: `Sec-WebSocket-Protocol: easy-job.<token>`), with a wrong `Host`, or with a foreign `Origin`.
- WebSocket `/ws` messages (types in `shared/office.ts`):
  - server → client: `state` (full `OfficeState`, throttled to 10/s), `activity` (new entries), `conversation` (new items for a pane the client subscribed to), `error`.
  - client → server: `watch-conversation {paneId}` / `unwatch-conversation`.
- REST (pane ids are URL-encoded, `w2:p1` → `w2%3Ap1`), every body validated with zod:

| Route | Does |
|---|---|
| `GET /api/state` | current `OfficeState` |
| `GET /api/agents/:pane/conversation?before=` | last 100 items (older pages with `before`) |
| `GET /api/agents/:pane/question` | `agent.read` with `source: detection`, ANSI stripped: the Question text |
| `POST /api/agents/:pane/prompt {text, attachments?}` | `agent.prompt`; `agent_blocked` → 409 "Answer its question first" |
| `POST /api/agents/:pane/keys {keys}` | `agent.send_keys`; allow only `enter`, `esc`, `y`, `n`, digits `1`–`9`, `up`, `down`, `tab` |
| `POST /api/agents/:pane/answer {text}` | send the text then `enter` |
| `POST /api/agents/:pane/interrupt` | `esc` (used by the Bonk action) |
| `POST /api/agents/:pane/seen` | store Seen mark = current `completion_seq` |
| `POST /api/agents/:pane/focus` | `agent.focus` (also marks Seen) |
| `POST /api/agents/:pane/rename {name}` | `agent.rename` |
| `PUT /api/agents/:pane/skin {skin}` | local skin override |
| `POST /api/projects/:ws/agents {kind, name?, prompt?}` | `tab.create` (no focus, cwd = project cwd) → `agent.start` → wait for `interactive_ready` (timeout 30s) → optional `agent.prompt` |
| `POST /api/projects/:ws/broadcast {text}` | `agent.prompt` to every non-blocked Agent of the Project; report per Agent |
| `POST /api/projects/:ws/focus` | `workspace.focus` |
| `POST /api/uploads` (multipart, ≤20MB, image/pdf/text) | save to `~/.easy-job/uploads/<pane>/<time>-<safe-name>`, return `{id, path}` |
| `GET /api/uploads/:id` | serve only files inside the uploads dir |
| `GET /api/skills?pane=` | skills + slash commands for that Agent (see below) |
| `GET /api/activity?before=` | Activity entries |

- Every action is logged to Activity.

### Conversation (`conversation/`)

- Locate: Claude → `~/.claude/projects/<slug>/<session>.jsonl`, falling back to a glob `~/.claude/projects/*/<session>.jsonl`; Codex → glob `~/.codex/sessions/**/rollout-*-<session>.jsonl`. Not found or unknown kind → terminal fallback (`agent.read`, `source: recent`, 200 lines, ANSI stripped, shown as one monospace block).
- **Look at real files before writing the parsers** and save a few redacted lines of each kind as fixtures. Known so far: Claude lines have `type` (`user`, `assistant`, `system`, …), `isSidechain`, `isMeta`, `timestamp`, `message.content` (string or blocks: `text`, `thinking`, `tool_use`, `tool_result`, `image`). Codex lines have `type` (`session_meta`, `response_item`, `event_msg`, …) and `payload`.
- Output one item type: `{id, at, role: 'user'|'agent'|'tool'|'system', text?, tool?: {name, summary, ok?, detail?}, images?: [{mime, dataUrl}]}`. Skip sidechains, meta lines and thinking. Tool calls show as one line ("Bash `bun test`" ✓). Images only for `image/png|jpeg|gif|webp`.
- Parsers never throw: unknown lines are skipped; a file that cannot be parsed at all falls back to terminal text.
- `watch.ts` tails with `fs.watch` + byte offset and pushes new items to watching clients.

### Skills (`skills.ts`)

Scan, de-duplicated by name: `<cwd>/.claude/skills/*/SKILL.md`, `<cwd>/.claude/commands/**/*.md`, `~/.claude/skills/*/SKILL.md`, `~/.claude/commands/**/*.md`, and enabled plugin skills under `~/.claude/plugins/`. Return `{name, description, source}` (description from frontmatter). Codex Agents: return Codex's own prompts dir if present, else an empty list.

### Composer rules

- Plain text → Prompt. `/name …` and `!command` are sent as typed: the agent's own TUI handles skills and shell mode.
- Attachments are uploaded first, then their absolute paths are appended on new lines (Claude: `@/abs/path`, Codex: `/abs/path`).
- `Enter` sends, `Shift+Enter` new line, `⌘V` pastes images, drag and drop works on the whole chat.

### Web

- `store.ts`: one store fed by the WebSocket (reconnect with backoff, refetch `/api/state` on reconnect), read through `useSyncExternalStore`. Components never open sockets.
- Hash routes: `#home` (default) and `#conversation/<pane>`.
- **Header**: logo, tabs `Home` / `Conversation`, counts (needs you, done, working, projects), connection dot.
- **Home**: left = floor area (Phase 2: a simple grouped list of Benches, Project → Agents, as a placeholder), right = **Manager panel**:
  - Needs-me alert strip (oldest first) with `Answer` → opens that Agent below.
  - **Project tabs**: `All` + one tab per Project with Agents (count badge, gold when one needs you), then the empty Projects under a `+` menu. Order: needs-me first, then Orcha order.
  - Agent list of the chosen tab (portrait, name, task, status chip, waiting time) and `+ New agent`.
  - **Mini chat** of the chosen Agent: last messages, Question card, composer, `Full chat ↗` to the Conversation screen.
- **Conversation**: left = Agents grouped by Project (search `/`, `+ agent` per Project), right = full chat with header actions: Show on floor, Open in Orcha, Rename, Skin.
- **Question card** (any Needs-me Agent): Question text, buttons `Yes ⏎`, `Always 2`, `No esc`, free-text answer. Keyboard: `Enter`, `2`, `Esc` when the card is focused.
- **New agent dialog**: kind (claude / codex / others from `server.agent_manifests` if available), optional name, optional first prompt.
- **Signals**: play `request.mp3` on a new Needs-me, `done.mp3` on Done (bridge serves Orcha's sound files; mute toggle in the header, saved in localStorage); browser Notification on Needs-me only while the tab is hidden (ask permission on first click of the bell); tab title `(N) Easy Job` where N = needs-me count.
- **States**: Orcha not running (full-screen card with the socket path and "start Orcha"), token missing ("open Easy Job from the terminal with `bun start`"), no Agents yet, Conversation not found (terminal fallback notice).
- Look: follow `docs/style/style-guide.html` tokens (navy `#2f3a4f` outline, chunky shadows, gold only for Needs me). Fonts: Chakra Petch for headings/buttons/labels, IBM Plex Sans for text, JetBrains Mono for ids, paths and terminal text.

**Acceptance**
- From the browser: answer a blocked Claude Agent with Yes and with free text; send a prompt; prompt to a blocked Agent shows "Answer its question first"; start a new claude Agent in a Project (a new tab appears in Orcha, focus does not move) with a first prompt; rename; Open in Orcha; send a `/skill` and a `!ls`; attach a pasted screenshot and the Agent reads it.
- Conversation shows real messages and tool lines for a Claude and a Codex Agent, live as they work.
- Opening a Done Agent turns it idle in the office (Orcha unchanged); its next finish shows Done again.
- Requests without the token, or with `Origin: https://example.com`, are rejected (test it).
- No HTML from agent output is rendered (test with an agent that prints `<img src=x onerror=alert(1)>`).

## Phase 3: The floor (Phaser)

Goal: the pixel floor on the left of Home, synced with the Manager panel.

### Borrow from the fleet (copy, then simplify; do not link)

`dashboard/src/office/mountPhaser.ts` (sizing, DPR, ResizeObserver), `renderer.ts` (the React ↔ scene contract idea), `pathfind.ts` (grid + our own smoothing), `trim.ts`, and the patterns in `OfficeScene.ts`: `crisp()` text with LINEAR filtering redrawn after `document.fonts.ready`, Zone hit areas at the feet, focusing the canvas host on pointerdown, 16/32px icons only. Drop everything about mesh, owners, privacy, parties, approvals, 3D.

### Layout engine (`floor/layout.ts`, pure, unit tested)

- Tile 32px. Front wall band at the top (door, banner, KPI board, clock, CCTV, windows). Two columns of Benches with an aisle in the middle; a Bench row every 2 tiles of depth + 1 tile aisle.
- `layoutFloor(projects, memory) → {benches, seats, grid, door}`: Benches in Orcha order, filling left column then right, row by row. Every Bench has exactly 4 seats. A Project gets `max(1, ceil(agents / 4), benches it had earlier this page session)` Benches, placed one after another; the extra ones are tagged `name_1`, `name_2`… (section 5 item 16).
- Seat assignment is stable: a pane keeps its seat while it lives; a new Agent takes the first free seat; memory survives reloads (bridge `local.ts`).
- Walk grid: walls and desks blocked, aisles and the area behind chairs walkable, door tile = spawn.

### Scene (`floor/FloorScene.ts`)

- Sprites from the manifest when present; otherwise **placeholder textures generated at runtime** by porting the drawing code in `docs/style/style-guide.html` (`worker()`, `bench()`, `bubble()`, wall) into functions that paint offscreen canvases registered as Phaser textures under the same keys the manifest would use. Swapping in Codex's art must need no code change.
- **Project colour on uniforms**: draw the character sheet, then the matching `-polo` layer on top with `setTint(projectColor)` (see art brief). Portraits the same way. Placeholders paint the polo directly.
- **Status visuals** (style guide §2): the monitor screen is a rectangle the code paints (blue with scrolling lines / gold blinking / green ✓ / dark / grey static); pose from the sheet (type↑, hand↑, relax↑, nap↑); bubbles `!` (gold marker asset), `✓`, `z`, `?`; a Needs-me Bench outline blinks gold.
- **Bench tag**: `TEAM 02 · acme-superapp` (+ `!N`) under each Bench, team number = position on the floor, crisp text, clickable (selects that Project tab).
- **Front wall**: banner text `HIT TARGET TODAY · SLEEP TOMORROW`, KPI leaderboard drawn from live counts (teams ranked by Done today, red flower on #1), recruitment poster `EASY JOB · HIGH PAY`, clock showing local time, CCTV LED blink, gong **struck with `done.mp3` whenever an Agent becomes Done**.
- **Props**: phone rack at every seat, noodle cartons and drink crates along the side walls, dorm door with bunks, boss office (glass, cash, money counter) at the bottom of the floor, all from the manifest with placeholder fallbacks.
- **Life cycle**: a new Agent appears at the door and walks to its seat along the path grid, then sits; an ended Agent is carried out by two HR bouncers; a closed Project's Bench burns (section 5 items 16–18).
- **Selection**: click a worker → select it in the Manager panel (mini chat opens, Seen). Selecting in the panel → camera pans to the worker and it pulses.
- **Camera**: drag to pan, wheel / pinch to zoom (integer zoom steps for crispness); far zoom shows tags and status dots only.
- **The Boss** (the Observer's character, `characters/boss.png`: black shirt, sunglasses, walkie-talkie): spawns in the boss office, moves with WASD/arrows and click-to-walk (pathfinding). Within 1.5 tiles of a worker, an action menu shows above it (HTML overlay positioned from the scene). Every action plays a short animation + sound, then calls the bridge:

| Action | Animation | Calls |
|---|---|---|
| Tap shoulder | Boss taps, worker turns | select + open mini chat, Seen |
| Knock "Back to work" | knuckles on desk, worker jumps | Prompt with the configurable nudge text (default `continue`); only for idle Agents |
| Buzzer | desk buzzer, cartoon jolt and stars | nothing (fun only) |
| Bonk | rolled newspaper bonk, stars | `interrupt` (Esc); asks "Interrupt Headset?" first |
| Megaphone | Boss shouts at the whole Bench | opens a one-line prompt, sends to all Agents of the Project (`broadcast`) |
| Whip crack | cracks a whip in the air above the desk, worker jumps (cartoon) | nothing (fun only) |
| Zap | cartoon zapper: hair on end, skeleton flash, smoke puff | nothing (fun only) |
| Coffee | hands over a cup, ♥ | nothing (fun) |
| High-five | both raise hands | nothing (fun only) |

- **Two kinds of Boss actions.** *Work* actions call the bridge: Tap shoulder, Knock, Bonk, Megaphone. *Fun* actions only play animation + sound and never touch the Agent: Buzzer, Whip crack, Zap, Coffee, High-five. The menu shows work actions first, fun ones in a second row; fun actions work on any status and can be spammed (no confirm). Activity logs fun actions only as a light line ("Boss zapped Headset").
- Keyboard: `n` = next Needs-me (camera + panel), `/` = search, `Esc` closes menus. Respect `prefers-reduced-motion` (no bob/blink, static markers).

**Acceptance**
- 16 Benches from today's Orcha show with correct tags and statuses; a new Project in Orcha adds a Bench at the end; a new Agent walks in and sits; closing it makes it walk out.
- Statuses read correctly at mid zoom from the screens and bubbles alone.
- Map click ↔ panel selection stay in sync both ways.
- The Boss walks around the furniture, every action does what the table says, Bonk asks first, and fun actions never send anything to Orcha (verify with the fake Orcha's recorded calls).
- Replacing `manifest.json` with Codex's file swaps placeholders for art with no code change (try with one sprite).

## Phase 4: Polish

- Empty states everywhere; Orcha-not-running screen tested by stopping Orcha.
- Activity ticker under the floor (last 3 entries) and a full Activity list in the Manager panel's `All` tab footer.
- Phone width (≤ 480px): Manager panel first, floor behind a `Floor` toggle, no horizontal scroll.
- Settings popover: nudge text, sound on/off, notifications on/off, Boss skin.
- `bun start` builds the web app and starts the bridge in one command; `bun run dev` runs bridge + Vite with proxy and hot reload.
- Everything in section 7: the `easy-job` CLI and compiled binary, `install-local`, `doctor`, `autostart`, the Orcha plugin, the Start Orcha button.
- README: what it is, requirements, `bun install`, `bun start`, `--session`, `--port`, where local data lives (`~/.easy-job/`), security model (token, localhost), how to drop in new art.
- Final pass: grep for `dangerouslySetInnerHTML`, external URLs, `console.log` noise; run all acceptance lists again.

## Handing back for review

After Phase 4, list every file changed, the commands to run, and any acceptance item that did not pass. The reviewer will check the diff against this plan, the ADRs and `CONTEXT.md`.
