import type { ConversationItem } from "@easy-job/shared";
import { parseClaudeLine } from "./claude.ts";
import { parseCodexLine } from "./codex.ts";
import { parseCursorLine } from "./cursor.ts";
import { locateTranscript, readTranscript, type TranscriptHit } from "./load.ts";
import fs from "node:fs";

export type TranscriptWatch = {
  hit: TranscriptHit;
  items: ConversationItem[];
  close(): void;
};

/** Tail a transcript. New lines are parsed and handed to `onItems`. `fs.watch` can miss an append, so the file is also stated on an interval. */
export function watchTranscript(
  input: { kind?: string; cwd?: string; session?: string; home?: string; pollMs?: number; transcriptPath?: string },
  onItems: (items: ConversationItem[]) => void,
  watchFile: (file: string, listener: () => void) => { close(): void } = (file, listener) => fs.watch(file, listener),
): TranscriptWatch {
  const hit = locateTranscript(input);
  if (hit.kind === "missing") return { hit, items: [], close() {} };
  let items: ConversationItem[] = [];
  try {
    items = [...readTranscript(hit)];
  } catch {
    items = [];
  }
  let offset = 0;
  try {
    offset = fs.statSync(hit.file).size;
  } catch {
    return { hit, items, close() {} };
  }
  let pending = Buffer.alloc(0);
  const parse = hit.kind === "claude" ? parseClaudeLine : hit.kind === "codex" ? parseCodexLine : parseCursorLine;
  const readNew = () => {
    try {
      const stat = fs.statSync(hit.file);
      if (stat.size < offset) {
        offset = 0;
        pending = Buffer.alloc(0);
      }
      if (stat.size === offset) return;
      const fd = fs.openSync(hit.file, "r");
      const length = stat.size - offset;
      const chunk = Buffer.alloc(length);
      fs.readSync(fd, chunk, 0, length, offset);
      fs.closeSync(fd);
      offset = stat.size;
      // Split on newline bytes before decoding, so a multi-byte character cut by a chunk edge stays whole.
      pending = Buffer.concat([pending, chunk]);
      const cut = pending.lastIndexOf(0x0a);
      if (cut < 0) return;
      const complete = pending.subarray(0, cut).toString("utf8");
      pending = Buffer.from(pending.subarray(cut + 1));
      const fresh: ConversationItem[] = [];
      for (const line of complete.split("\n")) {
        if (!line.trim()) continue;
        fresh.push(...parse(line));
      }
      const out = foldResults(items, fresh);
      if (out.length) onItems(out);
    } catch (error) {
      console.error(`transcript watch: ${error instanceof Error ? error.message : error}`);
    }
  };
  const watcher = watchFile(hit.file, readNew);
  const timer = setInterval(readNew, input.pollMs ?? 2_000);
  timer.unref?.();
  return {
    hit,
    items,
    close() {
      clearInterval(timer);
      watcher.close();
    },
  };
}

/**
 * A tool result arrives on a later line than its call. Live, fold it into the call already sent (same id, so the
 * browser replaces it) instead of showing a separate "result" line, the way a full read does.
 */
export function foldResults(items: ConversationItem[], fresh: ConversationItem[]): ConversationItem[] {
  const out: ConversationItem[] = [];
  for (const item of fresh) {
    if (item.role === "tool" && item.tool?.name === "result") {
      const callId = item.id.replace(/-result$/, "");
      let index = -1;
      for (let at = items.length - 1; at >= 0 && index < 0; at -= 1) if (items[at]?.id === callId && items[at]?.tool?.name !== "result") index = at;
      const call = items[index];
      if (call?.tool) {
        const updated: ConversationItem = {
          ...call,
          tool: { ...call.tool, ok: item.tool.ok, summary: item.tool.summary && call.tool.summary === call.tool.name ? item.tool.summary : call.tool.summary },
          ...(item.images ? { images: [...(call.images ?? []), ...item.images] } : {}),
        };
        items[index] = updated;
        const sent = out.findIndex((entry) => entry.id === callId);
        if (sent >= 0) out[sent] = updated; else out.push(updated);
        continue;
      }
    }
    items.push(item);
    out.push(item);
  }
  return out;
}
