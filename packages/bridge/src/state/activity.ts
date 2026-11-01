import type { ActivityEntry, ActivityKind } from "@easy-job/shared";
import fs from "node:fs";
import path from "node:path";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TEXT = 200;

export type ActivityLog = {
  file: string;
  entries(): ActivityEntry[];
  append(entry: { kind: ActivityKind; text: string; paneId?: string; agentKey?: string; workspaceId?: string; at?: number }): ActivityEntry;
  recent(limit: number, before?: number): ActivityEntry[];
};

export function openActivity(file: string, now = Date.now()): ActivityLog {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const entries = read(file).filter((entry) => now - entry.at <= WEEK_MS);
  if (entries.length !== read(file).length) rewrite(file, entries);

  return {
    file,
    entries: () => entries,
    recent(limit, before) {
      const filtered = before == null ? entries : entries.filter((entry) => entry.at < before);
      return filtered.slice(-limit).reverse();
    },
    append(input) {
      const text = input.kind === "action" ? input.text.slice(0, MAX_TEXT) : input.text;
      const entry: ActivityEntry = {
        id: `${input.at ?? Date.now()}-${entries.length}`,
        at: input.at ?? Date.now(),
        kind: input.kind,
        text,
        paneId: input.paneId,
        agentKey: input.agentKey,
        workspaceId: input.workspaceId,
      };
      entries.push(entry);
      fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
      return entry;
    },
  };
}

function read(file: string): ActivityEntry[] {
  if (!fs.existsSync(file)) return [];
  const entries: ActivityEntry[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as ActivityEntry);
    } catch {
      console.error("skipped a damaged Activity line");
    }
  }
  return entries;
}

function rewrite(file: string, entries: ActivityEntry[]): void {
  const body = entries.map((entry) => JSON.stringify(entry)).join("\n");
  fs.writeFileSync(file, body.length ? `${body}\n` : "");
}

export function activityFile(home: string): string {
  return path.join(home, "activity.jsonl");
}
