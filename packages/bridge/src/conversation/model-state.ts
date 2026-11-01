import { LRUCache } from "lru-cache";
import fs from "node:fs";
import type { ModelSettings } from "@easy-job/shared";
import type { TranscriptHit } from "./load.ts";

const EFFORT = /^(none|minimal|low|medium|high|xhigh|max|ultra)$/;
const ID = /^[\w.:/-]{1,80}$/;
const cache = new LRUCache<string, { size: number; mtime: number; settings: Partial<ModelSettings> }>({ max: 200 });
const TAIL = 2 * 1024 * 1024;

/** Read configuration records only. Messages, prompts and tool output never leave this reader. */
export function parseSessionModel(
  raw: string,
  kind: string,
  from: Partial<ModelSettings> = {},
): Partial<ModelSettings> {
  let state: Partial<ModelSettings> = { ...from };
  for (const line of raw.split("\n")) {
    try {
      const record = JSON.parse(line);
      let settings: Record<string, unknown> | undefined;
      if (kind === "codex") {
        if (record.type === "turn_context") settings = record.payload;
        else if (record.type === "event_msg" && record.payload?.type === "thread_settings_applied")
          settings = record.payload.thread_settings;
      } else if (kind === "claude" && record.type === "assistant" && !record.isSidechain) settings = record.message;
      else if (kind === "cursor" && ["system", "assistant"].includes(record.role ?? record.type))
        settings = record.message ?? record;
      if (!settings) continue;
      const model = typeof settings.model === "string" && ID.test(settings.model) ? settings.model : undefined;
      if (model && model !== state.model) state = { model };
      const effort = settings.effort ?? settings.reasoning_effort ?? settings.reasoningEffort;
      if (typeof effort === "string" && EFFORT.test(effort)) state.effort = effort;
      const tier = settings.service_tier ?? settings.serviceTier;
      if (tier === "priority" || tier === "fast") state.fast = true;
      if (tier === "default" || tier === "standard" || tier === "flex") state.fast = false;
    } catch {
      /* Partial or unrelated JSON lines are not configuration. */
    }
  }
  return state;
}

export function readSessionModel(hit: TranscriptHit): Partial<ModelSettings> {
  if (hit.kind === "missing") return {};
  try {
    const stat = fs.statSync(hit.file),
      previous = cache.get(hit.file);
    if (previous?.size === stat.size && previous.mtime === stat.mtimeMs) return previous.settings;
    // A growing transcript is read from where the last read stopped (whole lines only), not re-parsed from the tail.
    const grown = previous && stat.size > previous.size && stat.size - previous.size < TAIL;
    const start = grown ? previous.size : Math.max(0, stat.size - TAIL),
      buffer = Buffer.alloc(stat.size - start),
      fd = fs.openSync(hit.file, "r");
    try {
      fs.readSync(fd, buffer, 0, buffer.length, start);
    } finally {
      fs.closeSync(fd);
    }
    const end = buffer.lastIndexOf(0x0a) + 1;
    if (grown && end === 0) return previous.settings;
    const raw = buffer.subarray(0, grown ? end : buffer.length).toString("utf8");
    const settings = grown
      ? parseSessionModel(raw, hit.kind, previous.settings)
      : parseSessionModel(start ? raw.slice(raw.indexOf("\n") + 1) : raw, hit.kind);
    if (cache.size > 100) cache.clear();
    cache.set(hit.file, { size: grown ? start + end : stat.size, mtime: stat.mtimeMs, settings });
    return settings;
  } catch {
    return {};
  }
}
