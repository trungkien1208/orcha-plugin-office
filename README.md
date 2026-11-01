<p align="center"><img src="packages/web/public/office/landing/brand/easy-chair-224.png" width="112" alt="Easy Job logo: the letters ej shaped like an office chair"></p>

# Easy Job

A pixel-art office for the AI agents you run in [Orcha](https://github.com/trungkien1208/orcha).
[Try the sample office in your browser](https://trungkien1208.github.io/orcha-plugin-office/).

## First, Orcha

[Orcha](https://github.com/trungkien1208/orcha) is a terminal app that runs Claude Code, Codex and Cursor side by side, grouped into workspaces, and tells
you which agent is working, which one is waiting for you and which one is done.

Easy Job does not run agents itself. It connects to the Orcha on your machine and draws what Orcha sees. No Orcha,
nothing to show.

## What Easy Job adds

![The Floor: three Projects at their Benches, the Boss in the aisle, and a Conversation open beside it](docs/readme/floor.png)

- Each Orcha workspace is a team at a Bench; each agent sits at a Desk.
- A raised hand means an agent has a question. Click it, read the question, answer from the page.
- Each agent has a chat with its files, git changes and remaining fuel next to it.
- You walk the Floor as the Boss: knock to nudge an agent, megaphone a prompt to a whole team, bonk to stop one
  (it asks first).

It runs only on your machine: 127.0.0.1, a token per run, no account, no telemetry.

## Install

```bash
# 1. Get Orcha (skip if you have it)
curl -fsSL https://raw.githubusercontent.com/trungkien1208/orcha/HEAD/install.sh | sh

# 2. Add Easy Job and open it
orcha office install
orcha office
```

macOS shown; for Windows see [Orcha's install guide](https://github.com/trungkien1208/orcha#install).
Needs Orcha 0.9.12 or later.

| Command | Does |
|---|---|
| `orcha office` | Open the office. |
| `orcha office update` | Get the newest Easy Job (Orcha tells you when one is out). |
| `orcha office remove` | Remove it (asks first, keeps your data unless you say so). |

### Updates

Orcha checks for a new Easy Job once a day; Easy Job itself never goes online. When one is out, the office shows
"Easy Job X is out · Update". Click it and Orcha installs the new build and restarts Easy Job; the page reconnects
on the new version. Nothing updates without that click. Settings → Connection has "Check now". If the new version
needs a newer Orcha, run `orcha update` first. Orcha before 0.11 shows no notice: use `orcha office update`.

### A shortcut

Plugins can't bring their own key. To open Easy Job with one, add this to Orcha's `config.toml` (`prefix+e` is
the scrollback editor):

```toml
[[keys.command]]
key = "prefix+shift+e"
type = "plugin_action"
command = "easy-job.open"
description = "open Easy Job"
```

## Development

With [Bun 1.4+](https://bun.sh/), from this folder:

```bash
bun install
bun run dev:fake        # the app on a fake Orcha with sample agents
bun run dev             # against your real Orcha, with hot reload
bun run check           # types, lint, tests
bun run install-local   # install your build as ~/.local/bin/easy-job (easy-job doctor checks the setup)
```

Start with `CLAUDE.md` (layout and rules) and `CONTEXT.md` (the words: Project, Agent, Bench, Boss…).
Releases: `docs/plan-release.md`. The landing page: `docs/landing-and-icons.md`.
