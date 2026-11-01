import { fdir } from "fdir";
import { LRUCache } from "lru-cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SkillInfo = { name: string; description: string; source: string };

// Skill folders change rarely and `~/.claude/plugins` can hold thousands of files; one scan serves 30 s.
const cache = new LRUCache<string, SkillInfo[]>({ max: 50, ttl: 30_000, fetchMethod: (key) => scan(...(JSON.parse(key) as [string, string, string])) });

export async function listSkills(cwd: string | undefined, kind: string | undefined, home = os.homedir()): Promise<SkillInfo[]> {
  return (await cache.fetch(JSON.stringify([cwd ?? "", (kind ?? "").toLowerCase(), home]))) ?? [];
}

async function scan(cwd: string, kind: string, home: string): Promise<SkillInfo[]> {
  if (kind === "codex") {
    const prompts = path.join(home, ".codex", "prompts");
    return (await walkMarkdown(prompts)).map((file) => ({ name: path.basename(file, ".md"), description: frontmatterDescription(file), source: file }));
  }
  const roots = [
    cwd ? path.join(cwd, ".claude", "skills") : "",
    cwd ? path.join(cwd, ".claude", "commands") : "",
    path.join(home, ".claude", "skills"),
    path.join(home, ".claude", "commands"),
    path.join(home, ".claude", "plugins"),
  ].filter(Boolean);
  const seen = new Set<string>();
  const skills: SkillInfo[] = [];
  for (const root of roots) {
    for (const file of await walkMarkdown(root)) {
      // Skill folders hold SKILL.md plus notes, evals and outputs; only SKILL.md (or a command file) is a skill.
      if (!isSkillFile(root, file)) continue;
      const name = skillName(root, file);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      skills.push({ name, description: frontmatterDescription(file), source: file });
    }
  }
  return skills;
}

function isSkillFile(root: string, file: string): boolean {
  if (path.basename(file) === "SKILL.md") return true;
  if (root.endsWith(`${path.sep}commands`)) return true;
  return path.relative(root, file).split(path.sep).includes("commands");
}

function skillName(root: string, file: string): string {
  const rel = path.relative(root, file);
  if (file.endsWith(`${path.sep}SKILL.md`) || file.endsWith("/SKILL.md")) {
    return path.basename(path.dirname(file));
  }
  return rel.replace(/\.md$/, "").split(path.sep).filter((part) => part !== "commands" && part !== "skills").join(":") || path.basename(file, ".md");
}

function frontmatterDescription(file: string): string {
  let raw = "";
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
  if (!raw.startsWith("---")) return "";
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return "";
  const block = raw.slice(3, end);
  const match = /^description:\s*(.*)$/m.exec(block);
  return match?.[1]?.replace(/^["']|["']$/g, "").trim() ?? "";
}

/** Markdown files under a folder, hidden entries skipped, crawled without blocking the server. */
async function walkMarkdown(root: string): Promise<string[]> {
  if (!fs.existsSync(root)) return [];
  return new fdir()
    .withFullPaths()
    .exclude((name) => name.startsWith("."))
    .filter((file) => file.endsWith(".md") && !path.basename(file).startsWith("."))
    .crawl(root)
    .withPromise();
}
