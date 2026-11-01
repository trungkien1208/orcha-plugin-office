# Plan: next features (2026-10-31)

Agreed with the Owner. Each feature splits into backend (Cursor, packages/bridge + packages/shared) and UI (Codex, packages/web), contract-first: the shared types and stub routes land before the UI.

## 1. Hand off when fuel runs out (priority 1)
- When an Agent's HP (5-hour fuel) drops under 10 %, the header and the rail show "Low fuel: hand off?".
- Hand off = new Agent on another account or kind, opened next to the old one in Orcha, seeded with notes built by Orcha's `scripts/handoff.py <pane> <agent> <mode>` (full or summary). The old Agent stays until the Owner removes it.
- BE: `/api/agents/:pane/handoff {to: kind|accountId, mode}` runs the script with the user's Orcha binary (`HERDR_BIN_PATH`), returns the new pane. UI: dialog with target and mode, then select the new Agent; Floor shows HR carrying the new one in.

## 2. Task = branch + worktree + Agent (priority 1)
- "New task" in a Project: a title and a first prompt; Easy Job makes a branch (`<prefix><slug>`), a git worktree next to the repo, opens an Agent there (account/model picker), and labels the rail row with the task.
- Finishing a task: buttons to open a PR (see 3), merge locally, or remove the worktree (typed confirm, never deletes unmerged work without a warning).
- BE: worktree create/list/remove through `git` in the Project folder (Orcha's `worktree.list` for display), start the agent in the new folder. UI: dialog, task chip on rows and the Team thread.

## 3. Review the diff and send fixes (priority 1)
- Changes tab: click a line to leave a note; notes collect into a tray; "Send to agent" turns them into one prompt with file:line references.
- Git buttons with confirms: commit (message suggested from the notes or asked of the Agent), push, open PR (with `gh` when installed), all shown in Activity.
- BE: `/api/agents/:pane/git/{commit,push,pr}` with typed confirms and clear errors; never force-push. UI: inline note boxes, tray, buttons.

## 4. Auto-approve rules
- Per Project or global: rules like "always allow running tests", "always allow reading files in this repo", matched on the question text and the tool line. A rule only answers with the option the Owner picked when creating it.
- Every auto-answer goes to Activity and the conversation ("Auto-approved by rule: run tests"). Pause all rules with one switch; calm mode does not change rules.
- BE: rule store in `~/.easy-job/rules.json`, matcher on blocked questions, answer through the existing `/keys` path, tests for matching. UI: "Always" on a question offers "Make a rule…", a Rules page.

## 5. Agent presets
- Saved roles (Reviewer, Tester, Frontend…): first prompt, kind, model, account, skin, skills to mention. New Agent shows presets first.
- BE: `~/.easy-job/presets.json` CRUD. UI: preset picker and editor.

## 6. Search old conversations
- Search across every Agent's transcripts (current and past sessions found on disk for the Project folders), with filters by Project, Agent kind and date; open a result read-only or resume it in a new Agent.
- BE: on-demand scan with a small index cache in `~/.easy-job/`, never sent anywhere. UI: search page and result viewer.

## 7. End-of-day recap
- Per Project and Agent: tasks done, commits, files changed, fuel used, Agents still waiting or working, from Activity, git and the fuel cache. Copy as Markdown.
- BE: `/api/recap?day=` built locally. UI: a Recap view and a small daily card.

## 8. Non-agent terminals
- Panes without an agent (dev servers, test watchers) listed under their Project: live output (read-only, plain text), restart (Ctrl+C then the last command, with confirm), open in Orcha.
- BE: pane list from the snapshot, `agent.read`-style text reads, send-keys for restart. UI: a Terminals section in the rail and a viewer.

## Order
Batch A: 1 + the account switch guards. Batch B: 2 + 3. Batch C: 4 + 5. Batch D: 6 + 7 + 8.
