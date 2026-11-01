# Easy Job

A local, game-like view of what Orcha is running: each Orcha project is a room, each coding agent is a character at a desk, so it is obvious at a glance who is working, who needs the user, and who is done.

## Language

**Project**:
An Orcha workspace, shown as one Bench on the office Floor.
_Avoid_: Space, workspace (in UI copy)

**Agent**:
A coding agent (claude, codex, cursor…) that Orcha has detected in a pane; only Agents become characters.
_Avoid_: Worker, bot, pane

**Terminal**:
A pane with no detected Agent (a plain shell); not drawn, only counted on its Project's nameplate.
_Avoid_: Shell pane, idle pane

**Status**:
An Agent's state as Orcha reports it: `working`, `blocked`, `done`, `idle` or `unknown`.

**Needs me**:
UI name for the `blocked` Status: the Agent is waiting for the user's answer.
_Avoid_: Approval, waiting

**Done**:
An Agent that finished and the user has not looked at yet (Orcha: idle and not yet seen).

**Seen**:
The user has looked at an Agent's latest finish, either by opening it in the office or in Orcha; a Seen Agent shows as idle until it finishes again.

**Floor**:
The one open office the map shows; every Bench sits on it.
_Avoid_: Map, room

**Bench**:
A long desk of exactly 4 seats side by side, tagged with its Project's name (plus `_1`, `_2`… when the Project needs more than one); a Project's first Bench keeps its place on the Floor even with no Agents.
_Avoid_: Room, pod, table, cluster

**Desk**:
One seat at a Bench; each Agent keeps the same Desk for as long as it lives.
_Avoid_: Seat, slot

**Skin**:
The look of an Agent's character, all in the company polo. A default cast of 16 (8 humans, 2 robots, 2 dogs, 2 cats, a raccoon, a capybara) is picked from the pane; extra humans can be chosen by the user.

**Agent name**:
The Agent's stable label: its Orcha name if set, otherwise its Skin's name; never the current task.
_Avoid_: Title, task (as a label)

**Task**:
What the Agent is doing right now (Orcha's task/stage tokens or terminal title); shown in bubbles and the panel, changes often.

**Project colour**:
A stable colour per Project, carried by its Bench's tag and by the uniform of every Agent in it.

**Observer**:
The user: watches every Project and Agent at once and steps in only when an Agent Needs them.

**Question**:
What a Needs-me Agent is asking, read from the part of its screen Orcha uses to detect the blocked state.
_Avoid_: Prompt (that is what the user sends), approval request

**Answer**:
The user's reply to a Question: a key (Enter, y, n, Esc) or short text sent to the Agent.

**Prompt**:
New instructions the user sends to an Agent that is not Needs-me.

**Conversation**:
An Agent's messages and tool calls, read from its own session file (Claude, Codex), or its recent terminal text when no session file is available.
_Avoid_: Transcript, chat log

**Attachment**:
An image or file the Observer adds to a Prompt; stored on this machine and handed to the Agent as a file path.

**Skill**:
A Claude skill or slash command the Observer can send to an Agent as a `/name` Prompt.

**Shell command**:
A `!command` Prompt that the Agent runs in its own shell mode, so the result lands in its Conversation.

**Waiting time**:
How long a Needs-me Agent has been waiting for an Answer.

**Activity**:
The local log of Status changes and of what the Observer sent, newest first.
_Avoid_: History, events

**Manager panel**:
The right side of Home: Needs-me alert, one tab per Project with its Agent count, the Agents of the chosen Project, and the chosen Agent's Conversation.
_Avoid_: Sidebar, inspector

**Team**:
How a Project's Bench is labelled on the Floor (`TEAM 02 · name`); the number is its place on the Floor.

**HR bouncers**:
Two characters who carry an ended Agent out of the Floor; they never act on a live Agent.

**Boss**:
The Observer's own character on the Floor, steered with keys or clicks. Work actions reach the Agent (tap, knock, whip crack = "hurry up" prompt, bonk = Stop, megaphone); gags are just for fun and never reach Orcha (buzzer, zap, coffee, high-five). Calm mode hides the gags.
_Avoid_: Player, avatar, manager

**Nudge**:
A short Prompt (default `continue`) the Boss sends to an idle Agent by knocking on its desk.

**Bonk**:
The Boss interrupting an Agent (Esc), always confirmed first.

**Broadcast**:
One Prompt sent by megaphone to every Agent of a Project.

**Attention list**:
The Agents that want the Observer, Needs-me first, then Done.
_Avoid_: Inbox, notifications

**Triage**:
Walking the Attention list one Agent at a time, answering each Question, until it is empty.

## Relationships

- A **Project** has zero or more **Agents** and zero or more **Terminals**
- An **Agent** belongs to exactly one **Project**, at one pane
- A **Terminal** becomes an **Agent** when Orcha detects an agent starting in it
- Every **Project** has exactly one **Bench** on the **Floor**, even with zero **Agents**; Benches do not appear or vanish as Agents come and go
- **Benches** fill two columns in Orcha's Project order when the page loads; while it is open nothing moves: a new Project or an extra Bench takes the next free place at the end
- A **Bench** always has exactly 4 **Desks**. A Project with more than 4 Agents gets more Benches, tagged `name_1`, `name_2`…; a single-Bench Project has no suffix
- When an **Agent** ends, two **HR bouncers** carry it out of the door; when a **Project** closes, its Bench burns and leaves a scorch mark until the page reloads
- When an **Agent** starts, its character walks in from the door to its **Bench** and sits at a free **Desk**
- An Agent's screen shows its **Status** (blue working, gold Needs me, green Done, dark idle, grey unknown)
- The **Manager panel** groups Agents by **Project** in tabs; choosing an Agent opens its **Conversation** right there
- An **Agent**'s uniform carries its **Project colour**
- The office shows how many **Agents** are `working` and how many **Projects** are open

- A Needs-me **Agent** shows its **Question** in a bubble on the map; the Observer can **Answer** right there or open the **Conversation**
- A **Prompt** cannot be sent to a Needs-me Agent; it must be **Answered** first
- A new **Agent** started from the office gets its own new tab in its **Project**, without moving the Observer's Orcha view

## Example dialogue

> **Dev:** "The Search Jobs **Agent** is idle but still shows a green check — is it **Done**?"
> **Observer:** "Only if I haven't **Seen** that finish. Once I open it in the office it goes back to idle, until its next finish."
> **Dev:** "And if it's **Needs me**, can I send it a **Prompt** with the next task?"
> **Observer:** "No — first I **Answer** its **Question** from the bubble. Prompts are for Agents that aren't waiting on me."

## Flagged ambiguities

- "agent" in Orcha's API covers any pane with an agent record; plain shell panes are **Terminals**, not Agents.
