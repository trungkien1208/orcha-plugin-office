import type { ConversationItem } from "@easy-job/shared";

type CursorBlock = { type?: string; text?: string; name?: string; input?: Record<string, unknown> };
type CursorLine = { role?: string; timestamp?: string; createdAt?: string | number; message?: { content?: string | CursorBlock[] } };

/** Cursor IDE agent transcripts: `{role, message}` JSONL. Orcha's session id rarely matches these files. */
export function parseCursorLine(raw: string): ConversationItem[] {
  let line: CursorLine;
  try {
    line = JSON.parse(raw) as CursorLine;
  } catch {
    return [];
  }
  const role = line.role === "assistant" ? "agent" : line.role === "user" ? "user" : null;
  if (!role) return [];
  // Cursor lines usually carry no time; 0 tells the browser to show no clock rather than 1970.
  const at = typeof line.createdAt === "number" ? line.createdAt : Date.parse(String(line.timestamp ?? line.createdAt ?? "")) || 0;
  const id = lineId(raw);
  const content = line.message?.content;
  const blocks: CursorBlock[] = typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : [];
  const items: ConversationItem[] = [];
  const text = blocks.filter((block) => block.type === "text" || (!block.type && block.text)).map((block) => block.text ?? "").join("\n");
  const shown = role === "user" ? userQuery(text) : text;
  if (shown.trim()) items.push({ id, at, role, text: shown });
  for (const block of blocks) {
    if (block.type !== "tool_use" || !block.name) continue;
    const input = block.input ?? {};
    const first = typeof input.command === "string" ? input.command : Object.values(input).find((value) => typeof value === "string");
    items.push({ id: `${id}-tool-${items.length}`, at, role: "tool", tool: { name: block.name, summary: typeof first === "string" ? first.split("\n")[0]?.slice(0, 120) ?? "" : block.name, ok: true } });
  }
  return items;
}

/** Cursor wraps what you typed in `<user_query>` next to attached context; show only what you typed. */
export function userQuery(text: string): string {
  const query = text.match(/<user_query>([\s\S]*?)<\/user_query>/)?.[1];
  if (query !== undefined) return query.trim();
  return text.replace(/<(user_info|attached_files|project_layout|rules|system_reminder)>[\s\S]*?<\/\1>/g, "").trim();
}

export function parseCursorTranscript(raw: string): ConversationItem[] {
  return raw.split("\n").filter((line) => line.trim()).flatMap((line) => parseCursorLine(line));
}

function lineId(raw: string): string {
  let hash = 0;
  for (const char of raw) hash = Math.imul(hash, 31) + char.charCodeAt(0);
  return `cursor-${(hash >>> 0).toString(16)}`;
}
