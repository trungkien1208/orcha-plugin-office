import { LRUCache } from "lru-cache";
import { parseClaudeTranscript } from "./claude.ts";
import { parseCodexTranscript } from "./codex.ts";
import { parseCursorTranscript } from "./cursor.ts";
import type { ConversationItem } from "@easy-job/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHUNK = 256 * 1024;

export type TranscriptHit = { kind: "claude" | "codex" | "cursor"; file: string } | { kind: "missing" };

export type TranscriptQuery = { before?: string; after?: string; limit?: number };

export function claudeSlug(cwd: string): string {
  return cwd.replaceAll(/[/.]/g, "-");
}

const located = new LRUCache<string, Exclude<TranscriptHit, { kind: "missing" }>>({ max: 200 });

export function locateTranscript(input: {
  kind?: string;
  cwd?: string;
  session?: string;
  home?: string;
  /** Protocol 23: the file Orcha's hook reported. Used as is when it exists; otherwise the search below runs. */
  transcriptPath?: string;
}): TranscriptHit {
  const reported = reportedTranscript(input.kind, input.transcriptPath);
  if (reported) return reported;
  const session = input.session;
  if (!session) return { kind: "missing" };
  const home = input.home ?? os.homedir();
  const kind = (input.kind ?? "").toLowerCase();
  const key = `${kind}\0${session}\0${input.cwd ?? ""}\0${home}`;
  const cached = located.get(key);
  if (cached && fs.existsSync(cached.file)) return cached;
  const hit = findTranscript(kind, home, input.cwd, session);
  if (hit.kind !== "missing") located.set(key, hit);
  return hit;
}

function findTranscript(kind: string, home: string, cwd: string | undefined, session: string): TranscriptHit {
  if (kind === "claude" || kind === "") {
    const hit = findClaude(home, cwd, session);
    if (hit) return { kind: "claude", file: hit };
    if (kind === "claude") return { kind: "missing" };
  }
  if (kind === "codex" || kind === "") {
    const hit = findCodex(home, session);
    if (hit) return { kind: "codex", file: hit };
    if (kind === "codex") return { kind: "missing" };
  }
  if (kind === "cursor") {
    const hit = findCursor(home, session);
    if (hit) return { kind: "cursor", file: hit };
  }
  return { kind: "missing" };
}

function reportedTranscript(kind: string | undefined, file: string | undefined): TranscriptHit | null {
  if (!file || !file.endsWith(".jsonl") || !fs.existsSync(file)) return null;
  const known = (kind ?? "").toLowerCase();
  const which = known === "claude" || known === "codex" || known === "cursor"
    ? known
    : file.includes("/.codex/") ? "codex" : file.includes("/.cursor/") ? "cursor" : file.includes("/.claude/") ? "claude" : null;
  return which ? { kind: which, file } : null;
}

// Parsed tails are big; the last few dozen cover every open conversation.
const parsedTail = new LRUCache<string, { mtimeMs: number; size: number; items: ConversationItem[] }>({ max: 40 });

function findClaude(home: string, cwd: string | undefined, session: string): string | null {
  if (cwd) {
    const direct = path.join(home, ".claude", "projects", claudeSlug(cwd), `${session}.jsonl`);
    if (fs.existsSync(direct)) return direct;
  }
  const root = path.join(home, ".claude", "projects");
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root)) {
    const file = path.join(root, dir, `${session}.jsonl`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function findCodex(home: string, session: string): string | null {
  const root = path.join(home, ".codex", "sessions");
  if (!fs.existsSync(root)) return null;
  const needle = `rollout-${session}.jsonl`;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) break;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(needle) || (entry.name.startsWith("rollout-") && entry.name.endsWith(`-${session}.jsonl`))) {
        return full;
      }
    }
  }
  return null;
}

/** Cursor chat jsonl is named by the chat uuid, which is not Orcha's agent_session. */
function findCursor(home: string, session: string): string | null {
  const root = path.join(home, ".cursor", "projects");
  if (!fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root)) {
    const file = path.join(root, dir, "agent-transcripts", session, `${session}.jsonl`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

type Chunk = { text: string; olderEnd: number };

function readChunk(file: string, end: number): Chunk {
  const size = fs.statSync(file).size;
  const stop = Math.max(0, Math.min(size, end));
  const start = Math.max(0, stop - CHUNK);
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(stop - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString("utf8");
    let olderEnd = start;
    if (start > 0) {
      const cut = text.indexOf("\n");
      if (cut >= 0) {
        olderEnd = start + Buffer.byteLength(text.slice(0, cut + 1));
        text = text.slice(cut + 1);
      } else {
        text = "";
      }
    }
    return { text, olderEnd };
  } finally {
    fs.closeSync(fd);
  }
}

function parseHit(hit: TranscriptHit, raw: string): ConversationItem[] {
  if (hit.kind === "claude") return parseClaudeTranscript(raw);
  if (hit.kind === "codex") return parseCodexTranscript(raw);
  if (hit.kind === "cursor") return parseCursorTranscript(raw);
  return [];
}

/** Last lines of a transcript, paging older with `before` or newer-than `after`. Never reads the whole file. */
export function readTranscript(hit: TranscriptHit, query: TranscriptQuery = {}): ConversationItem[] {
  if (hit.kind === "missing") return [];
  const limit = query.limit ?? 100;
  const reusable = !query.before && !query.after && limit === 100;
  if (reusable) {
    const stat = fs.statSync(hit.file);
    const cached = parsedTail.get(hit.file);
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.items;
    const items = readTail(hit, query, limit);
    parsedTail.set(hit.file, { mtimeMs: stat.mtimeMs, size: stat.size, items });
    return items;
  }
  return readTail(hit, query, limit);
}

function readTail(hit: Exclude<TranscriptHit, { kind: "missing" }>, query: TranscriptQuery, limit: number): ConversationItem[] {
  let end = fs.statSync(hit.file).size;
  let items: ConversationItem[] = [];
  const seen = new Set<string>();
  while (end > 0) {
    const chunk = readChunk(hit.file, end);
    const parsed = parseHit(hit, chunk.text).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    items = parsed.concat(items);
    if (query.before) {
      const index = items.findIndex((item) => item.id === query.before);
      if (index >= 0) return items.slice(Math.max(0, index - limit), index);
    } else if (query.after) {
      const index = items.findIndex((item) => item.id === query.after);
      if (index >= 0) return items.slice(index + 1, index + 1 + limit);
    } else if (items.length >= limit || chunk.olderEnd === 0) {
      return items.slice(-limit);
    }
    if (chunk.olderEnd === 0 || chunk.olderEnd >= end) break;
    end = chunk.olderEnd;
  }
  if (query.before || query.after) return [];
  return items.slice(-limit);
}
