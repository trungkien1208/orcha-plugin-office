# Conversations come from the agents' own transcript files

Orcha only exposes an Agent's terminal text, which is too noisy to read as a chat. Claude Code and Codex already write every session to local JSONL files (`~/.claude/projects/<cwd-slug>/<session>.jsonl`, `~/.codex/sessions/**/rollout-*-<session>.jsonl`), and Orcha gives us the session id in `agent_session`. The bridge reads and watches those files to show a real Conversation, and falls back to `agent.read` terminal text when the agent kind is unknown or the file can't be found or parsed.

## Consequences

These file formats are not public APIs and can change with any Claude Code or Codex release. All parsing lives in one module per agent kind, is covered by recorded fixtures, and must degrade to terminal text instead of failing.
