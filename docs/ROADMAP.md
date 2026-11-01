# Easy Job: roadmap after v1

v1 is what `docs/PLAN.md` describes. Everything here is **out of scope for v1**; build none of it until the user picks it. Ordered by value inside each group; ★ = recommended next.

## 1. Giving out work

| Idea | What it is | Built on |
|---|---|---|
| ★ **Job board** | A queue of task cards per Project (or global). The Boss drops a card on a Team's Bench; the first idle Agent there picks it up (walks to the board, sits, gets the card as a Prompt). Cards show waiting / in progress / done. | `agent.prompt`, `agent.wait`, local store |
| ★ **Hire into a worktree** | "New agent" can also create a fresh git worktree + branch for the job, so parallel Agents don't collide. The Bench tag shows the branch. | Orcha `worktree.create`, `agent.start` |
| **Pipelines** | Simple rules: "when Agent A is Done, send this Prompt to Agent B" (e.g. coder → reviewer → tester). Drawn as a paper slip carried between Benches. | `agent.wait --until done`, `agent.prompt` |
| **Standing answers** | Per-Project rules that answer known Questions automatically (e.g. always allow `bun test` in this repo), with a log of every auto-answer and a kill switch. Risky: off by default, explicit allow-list only. | Question parsing, `agent.send_keys` |
| **Plugin actions** | Run Orcha plugin actions from the Manager panel. | `plugin.action.list/invoke` |

## 2. Seeing what happened

| Idea | What it is | Built on |
|---|---|---|
| ★ **Payroll (tokens and cost)** | Per Agent and per Team: tokens and estimated cost today, read from transcript usage fields. Shown as "salary" on the KPI board and in the panel. | transcript parsers |
| ★ **Daily standup** | One page per day: what each Team did (Prompts sent, Done count, files touched, time blocked), built from Activity + transcripts, no LLM needed. Optional "write a summary" button that asks one of your own Agents to summarise. | Activity, transcripts |
| **Search everything** | Full-text search across all Conversations, past and present. | transcript files |
| **Diff on the desk** | Read-only `git diff --stat` + diff of an Agent's cwd in the panel; link to its PR if `gh` finds one. | local git, `gh` |
| **Stuck detector** | Working for a long time with no transcript activity → sweat drop on the worker and a soft alert. | transcript tail timestamps |

## 3. Reach

| Idea | What it is | Built on |
|---|---|---|
| **Phone access** | Use Easy Job from the phone (Needs-me answers on the go): Tailscale serve + its own login, PWA install, web push. Needs a real auth design first (an ADR). | Tailscale, Web Push |
| **More floors** | Orcha can connect several machines (saved SSH servers). Each machine becomes a floor; an elevator switches floors; the HUD sums all floors. | Orcha multi-server |
| **Windows** | Named-pipe transport in `orcha/transport.ts`; paths for transcripts on Windows. | transport module |
| **Named sessions side by side** | Watch several Orcha sessions at once as separate floors. | `--session` |

## 4. Fun

| Idea | What it is |
|---|---|
| ★ **Employee of the month** | Framed portrait on the wall of the Agent with the most Done this month; the slacker gets the "noodle duty" badge. |
| **Day and night** | Lights and windows follow the local clock: dawn, daylight, night shift with neon. |
| **Events** | Gong storm when a Team clears its whole job board; confetti on the KPI board at #1; fire drill (everyone walks to the door) when Orcha restarts. |
| **Levels and badges** | Agents gain levels with finished jobs; badges on the name tag. |
| **More Boss gags and sounds** | New actions and a sound pack, all mapped to real API calls where possible. |
| **Record the floor** | Export a short GIF/MP4 of the floor to share. |
| **3D look** | Port the fleet's 3D renderer behind the same renderer contract. |

## How to pick up an item

1. The user picks it.
2. Write a short ADR if it is hard to reverse (auth for phone access, auto-answers).
3. Add a phase to `docs/PLAN.md` with modules, routes and acceptance checks, and new terms to `CONTEXT.md`.
4. New art goes into `docs/art-brief.md` for Codex.
