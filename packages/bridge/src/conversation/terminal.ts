import type { ConversationItem } from "@easy-job/shared";
import stripAnsi from "strip-ansi";

type ReadResult = { read?: { text?: string } };

/** One monospace block from `agent.read`. */
export function terminalConversation(result: unknown, paneId: string): ConversationItem[] {
  const text = stripAnsi((result as ReadResult)?.read?.text ?? "").replace(/\s+$/g, "");
  if (!text.trim()) return [];
  return [{ id: `terminal-${paneId}`, at: Date.now(), role: "system", text }];
}
