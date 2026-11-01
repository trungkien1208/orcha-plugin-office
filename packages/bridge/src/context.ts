// Everything around an Agent that is not in Orcha's snapshot: its account fuel and its git repo.
// All of it is read locally: Orcha's own usage cache (never the network) and `git` in the Agent's folder.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Agent, Fuel, GitContext } from "@easy-job/shared";
import { simpleGit } from "simple-git";
import { fdir } from "fdir";
import { LRUCache } from "lru-cache";
import { fuelWindows, paneConfigDir } from "./accounts.ts";
import type { OfficeLink } from "./orcha/link.ts";

const ORCHA_CONFIG = path.join(os.homedir(), ".config", "orcha");
const LIMITS = path.join(os.homedir(), ".cache", "orcha", "limits");

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function accountLabel(id: string): string {
  const config = readJson<{ accounts?: Array<{ id?: string; label?: string }> }>(path.join(ORCHA_CONFIG, "config.json"));
  return config?.accounts?.find((account) => account.id === id)?.label ?? id;
}

/** Orcha caches `{window: [percentUsed, resetEpochSeconds]}` per account; fuel is what is left. */
export function readFuel(account: string, limitsDir = LIMITS): Fuel | null {
  const raw = readJson<Record<string, unknown>>(path.join(limitsDir, `${account}.json`));
  if (!raw) return null;
  return { account, label: accountLabel(account), windows: fuelWindows(raw), note: typeof raw.note === "string" ? raw.note : undefined };
}

/** Which Claude account a pane runs on: its CLAUDE_CONFIG_DIR, else the account Orcha marks active. */
async function claudeAccount(link: OfficeLink, paneId: string): Promise<string> {
  const dir = await paneConfigDir(link, paneId);
  if (dir) return path.basename(dir);
  return fs.readFileSync(path.join(ORCHA_CONFIG, "claude-active"), "utf8").trim() || "claude-main";
}

const fuelCache = new LRUCache<string, { fuel: Fuel | null }>({ max: 200, ttl: 30_000 });

export async function fuelFor(link: OfficeLink, agent: Agent): Promise<Fuel | null> {
  const hit = fuelCache.get(agent.paneId);
  if (hit) return hit.fuel;
  let account = agent.accountId ?? agent.kind;
  if (agent.kind === "claude" && !agent.accountId) {
    try {
      account = await claudeAccount(link, agent.paneId);
    } catch {
      account = "claude-main";
    }
  }
  const fuel = readFuel(account) ?? (agent.kind === "claude" ? readFuel("claude-main") : null);
  fuelCache.set(agent.paneId, { fuel });
  return fuel;
}

/** A simple-git client for one folder; every git call is bounded so a slow repo never stalls a request. */
const gitIn = (dir: string) => simpleGit({ baseDir: dir, timeout: { block: 5000 } });
const STATUS_CODE = (index: string, work: string) =>
  index === "?" ? "A" : `${index}${work}`.includes("D") ? "D" : `${index}${work}`.includes("A") ? "A" : `${index}${work}`.includes("R") ? "R" : "M";

// A folder's repo root rarely changes; the Files tab, file views and chat images all need it.
const rootCache = new LRUCache<string, { root: string | null }>({
  max: 200,
  ttl: 60_000,
  fetchMethod: async (cwd) => ({ root: (await gitIn(cwd).revparse(["--show-toplevel"]).catch(() => "")).trim() || null }),
});

/** The repo root for a folder, or null when it is not in a git repo. */
export async function gitRoot(cwd: string | undefined): Promise<string | null> {
  if (!cwd || !fs.existsSync(cwd)) return null;
  return (await rootCache.fetch(cwd))?.root ?? null;
}

// Several panels ask for the same repo at once (context, header, Files); one git run answers them for 2 s.
const contextCache = new LRUCache<string, { git: GitContext }>({ max: 50, ttl: 2_000, fetchMethod: async (root) => ({ git: await readGitContext(root) }) });

export async function gitContext(cwd: string | undefined): Promise<GitContext | null> {
  const root = await gitRoot(cwd);
  return root ? ((await contextCache.fetch(root))?.git ?? null) : null;
}

async function readGitContext(root: string): Promise<GitContext> {
  const git = gitIn(root);
  const [status, unstaged, staged, log, worktrees] = await Promise.all([
    git.status().catch(() => null),
    git.diffSummary().catch(() => null),
    git.diffSummary(["--cached"]).catch(() => null),
    git.log({ maxCount: 12 }).catch(() => null),
    git.raw(["worktree", "list", "--porcelain"]).catch(() => ""),
  ]);
  const counts = new Map<string, { add: number; del: number }>();
  for (const file of [...(unstaged?.files ?? []), ...(staged?.files ?? [])]) {
    const current = counts.get(file.file) ?? { add: 0, del: 0 };
    const add = "insertions" in file ? file.insertions : 0;
    const del = "deletions" in file ? file.deletions : 0;
    counts.set(file.file, { add: current.add + add, del: current.del + del });
  }
  const changes = (status?.files ?? []).slice(0, 200).map((file) => ({
    status: STATUS_CODE(file.index, file.working_dir),
    path: file.path,
    ...(counts.get(file.path) ?? { add: 0, del: 0 }),
  }));
  const history = (log?.all ?? []).map((entry) => ({
    sha: entry.hash.slice(0, 7),
    subject: entry.message,
    at: Date.parse(entry.date) || 0,
    author: entry.author_name,
  }));
  // simple-git has no worktree API; `--porcelain` is git's stable machine format.
  const trees: GitContext["worktrees"] = [];
  for (const block of worktrees.split("\n\n").filter(Boolean)) {
    const dir = block.match(/^worktree (.+)$/m)?.[1] ?? "";
    const ref = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? (block.includes("detached") ? "detached" : "");
    if (dir) trees.push({ path: dir, branch: ref, current: path.resolve(dir) === path.resolve(root) });
  }
  return {
    root,
    branch: status?.current ?? "",
    upstream: status?.tracking ?? undefined,
    ahead: status?.ahead ?? 0,
    behind: status?.behind ?? 0,
    changes,
    added: changes.reduce((sum, change) => sum + change.add, 0),
    removed: changes.reduce((sum, change) => sum + change.del, 0),
    history,
    worktrees: trees,
  };
}

const FILE_CAP = 5000;
const SKIP_DIRS = ["node_modules", "dist", "build", "target", "vendor", "__pycache__"];

/** Repo files for the Files tab (tracked + untracked, ignored files left out). */
const fileCache = new LRUCache<string, string[]>({
  max: 50,
  ttl: 5_000,
  fetchMethod: async (root) => {
    const out = await gitIn(root).raw(["ls-files", "--cached", "--others", "--exclude-standard"]).catch(() => "");
    return out.split("\n").filter(Boolean).slice(0, FILE_CAP);
  },
});

export async function listFiles(root: string): Promise<string[]> {
  return (await fileCache.fetch(root)) ?? [];
}

/**
 * A folder that is not a git repo (it can be the home folder): at most `cap` files, six levels deep, hidden and
 * dependency folders skipped, crawled asynchronously so a huge folder never blocks the server. Shallow paths first.
 */
export async function walkFiles(root: string, cap = FILE_CAP): Promise<string[]> {
  const files = await new fdir()
    .withRelativePaths()
    .withMaxDepth(6)
    .withMaxFiles(cap)
    .exclude((name) => name.startsWith(".") || SKIP_DIRS.includes(name))
    .filter((file) => !path.basename(file).startsWith("."))
    .crawl(root)
    .withPromise();
  return files.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
}

/** A file inside the repo only; refuses anything that resolves outside it, binaries and big files. */
export function readRepoFile(root: string, relative: string): { path: string; text: string; truncated: boolean } | null {
  const full = path.resolve(root, relative);
  if (!full.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const buffer = fs.readFileSync(full);
  if (buffer.subarray(0, 8000).includes(0)) return { path: relative, text: "(binary file)", truncated: false };
  const limit = 200_000;
  return { path: relative, text: buffer.subarray(0, limit).toString("utf8"), truncated: buffer.length > limit };
}

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };

/** An image inside the repo, for the Files viewer and chat previews; anything else is refused. */
export function repoImage(root: string, relative: string): { file: string; type: string } | null {
  const full = path.resolve(root, relative);
  if (!full.startsWith(`${path.resolve(root)}${path.sep}`)) return null;
  const type = IMAGE_TYPES[path.extname(full).toLowerCase()];
  if (!type || !fs.existsSync(full) || !fs.statSync(full).isFile() || fs.statSync(full).size > 20 * 1024 * 1024) return null;
  return { file: full, type };
}

export async function fileDiff(root: string, relative: string): Promise<string> {
  const full = path.resolve(root, relative);
  if (!full.startsWith(`${path.resolve(root)}${path.sep}`)) return "";
  const diff = await gitIn(root).diff(["HEAD", "--", relative]).catch(() => "");
  if (diff) return diff.slice(0, 200_000);
  // A new, untracked file has no diff against HEAD: describe it as a whole-file addition in unified format.
  const file = readRepoFile(root, relative);
  if (!file || file.text === "(binary file)") return "";
  const lines = file.text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return [`diff --git a/${relative} b/${relative}`, "new file mode 100644", "--- /dev/null", `+++ b/${relative}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}
