import type { ConversationItem } from "@easy-job/shared";

type CodexLine = {
  type?: string;
  timestamp?: string;
  payload?: {
    type?: string;
    id?: string;
    role?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    input?: string;
    content?: unknown;
    output?: unknown;
  };
};

export function parseCodexLine(raw: string): ConversationItem[] {
  let line: CodexLine;
  try {
    line = JSON.parse(raw) as CodexLine;
  } catch {
    return [];
  }
  if (line.type !== "response_item" || !line.payload) return [];
  const payload = line.payload;
  const at = Date.parse(line.timestamp ?? "") || 0;
  if (payload.type === "reasoning" || payload.type === "session_meta") return [];
  if (payload.type === "message") {
    const role = payload.role === "assistant" ? "agent" : payload.role === "user" ? "user" : null;
    if (!role) return [];
    const text = textOf(payload.content);
    const images = imagesOf(payload.content);
    // Codex writes its own context into user turns (environment, AGENTS.md); the terminal never shows them as prompts.
    if (role === "user" && /^\s*(<environment_context>|<user_instructions>|<turn_aborted>|# AGENTS\.md instructions)/.test(text)) return [];
    if (!text && !images.length) return [];
    return [{ id: payload.id ?? `codex-${at}`, at, role, text, ...(images.length ? { images } : {}) }];
  }
  if (payload.type === "function_call" || payload.type === "custom_tool_call") {
    const name = payload.name ?? "tool";
    return [
      {
        id: payload.call_id ?? payload.id ?? `call-${at}`,
        at,
        role: "tool",
        tool: { name, summary: argSummary(payload.arguments ?? payload.input) },
      },
    ];
  }
  if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
    const { text: summary, ok } = outputOf(payload.output);
    return [
      {
        id: `${payload.call_id ?? payload.id ?? at}-result`,
        at,
        role: "tool",
        tool: { name: "result", summary: summary.replace(/\s+/g, " ").trim().slice(0, 160), ok },
      },
    ];
  }
  return [];
}

export function parseCodexTranscript(raw: string): ConversationItem[] {
  const items: ConversationItem[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    items.push(...parseCodexLine(line));
  }
  return foldResults(items);
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") parts.push(block);
    else if (block && typeof block === "object" && "text" in block && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

const IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,/;

function imagesOf(content: unknown): Array<{ mime: string; dataUrl: string }> {
  if (!Array.isArray(content)) return [];
  const images: Array<{ mime: string; dataUrl: string }> = [];
  for (const block of content) {
    const url = block && typeof block === "object" && "image_url" in block ? (block as { image_url?: unknown }).image_url : undefined;
    const match = typeof url === "string" ? url.match(IMAGE) : null;
    if (typeof url === "string" && match) images.push({ mime: `image/${match[1]}`, dataUrl: url });
  }
  return images;
}

/**
 * A tool's output and whether it worked: the exit code when Codex records one (JSON metadata or an "Exit code: N" line),
 * otherwise done. The word "error" in ordinary output (a grep hit, a log) is not a failure.
 */
export function outputOf(output: unknown): { text: string; ok: boolean } {
  let text = textOf(output);
  let code: number | undefined;
  try {
    const parsed = JSON.parse(text) as { output?: unknown; metadata?: { exit_code?: unknown } };
    if (parsed && typeof parsed === "object" && "output" in parsed) {
      text = textOf(parsed.output);
      if (typeof parsed.metadata?.exit_code === "number") code = parsed.metadata.exit_code;
    }
  } catch { /* plain text output */ }
  const line = text.match(/(?:^|\n)\s*(?:Exit code|Process exited with code)[:\s]+(-?\d+)/i);
  if (code === undefined && line?.[1]) code = Number(line[1]);
  return { text: text.replace(/^(?:Exit code: -?\d+\s*\n)?(?:Wall time:[^\n]*\n)?(?:Output:\s*\n)?/i, ""), ok: code === undefined ? true : code === 0 };
}

function argSummary(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.command === "string") return parsed.command.split("\n")[0] ?? parsed.command;
    // `shell` passes argv, usually ["bash", "-lc", "<script>"]: the script is what the terminal shows.
    if (Array.isArray(parsed.command)) { const last = parsed.command.at(-1); return typeof last === "string" ? (last.split("\n")[0] ?? last) : ""; }
    if (typeof parsed.code === "string") return parsed.code.split("\n")[0]?.slice(0, 120) ?? "";
    const first = Object.values(parsed).find((value) => typeof value === "string");
    return typeof first === "string" ? first.slice(0, 120) : raw.slice(0, 120);
  } catch {
    return raw.slice(0, 120);
  }
}

function foldResults(items: ConversationItem[]): ConversationItem[] {
  const calls = new Map(items.filter((item) => item.tool && item.tool.name !== "result").map((item) => [item.id, item]));
  const out: ConversationItem[] = [];
  for (const item of items) {
    if (item.tool?.name === "result") {
      const call = calls.get(item.id.replace(/-result$/, ""));
      if (call?.tool) {
        call.tool.ok = item.tool.ok;
        if (item.tool.summary) call.tool.detail = item.tool.summary;
        continue;
      }
    }
    out.push(item);
  }
  return out;
}
