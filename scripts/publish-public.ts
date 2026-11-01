// `bun scripts/publish-public.ts [--ref main] [--dry-run]`: publish a snapshot of this (private, full-history) repo
// to the public repo as one new commit. It exports the ref with `git archive`, leaves out folders that may hold
// real data (review screenshots), refuses to go on if any file still carries a personal or work name, then commits
// the tree on top of the public repo as the GitHub noreply author and pushes. Run it from a clean checkout.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PUBLIC_REMOTE = "https://github.com/trungkien1208/orcha-plugin-office.git";
const AUTHOR = "trungkien1208 <trungkien1208@users.noreply.github.com>";
/** Never published: screenshots from live sessions can show real projects, and the denylist names them. */
const EXCLUDE = ["docs/review", "scripts/publish-denylist.txt"];
/** Folders whose images stay private: art review sheets include screenshots of live sessions. */
const PRIVATE_IMAGES = ["docs/art-review"];
const IMAGE = /\.(png|jpe?g|gif|webp)$/i;
/** Personal and work names that must not leave the private repo, one case-insensitive regex per line. */
const LEAKS = fs
  .readFileSync(path.join(import.meta.dir, "publish-denylist.txt"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => new RegExp(line, "i"));

const args = process.argv.slice(2);
const ref = (args.includes("--ref") ? args[args.indexOf("--ref") + 1] : undefined) ?? "main";
const dryRun = args.includes("--dry-run");
const repo = path.resolve(import.meta.dir, "..");

function run(cmd: string, argv: string[], cwd: string, input?: Buffer): string {
  const result = spawnSync(cmd, argv, { cwd, input, maxBuffer: 1 << 30 });
  if (result.status !== 0) fail(`${cmd} ${argv.join(" ")}: ${result.stderr?.toString().trim()}`);
  return result.stdout.toString().trim();
}

function fail(message: string): never {
  process.stderr.write(`publish: ${message}\n`);
  process.exit(1);
}

function walk(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.name === ".git") return [];
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

const source = run("git", ["rev-parse", "--short", ref], repo);
const version = (JSON.parse(run("git", ["show", `${ref}:package.json`], repo)) as { version: string }).version;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-publish-"));
const tree = path.join(work, "tree");
fs.mkdirSync(tree);

// 1. Export the ref (tracked files only) and drop what is never published.
const archive = spawnSync("git", ["archive", "--format=tar", ref], { cwd: repo, maxBuffer: 1 << 30 });
if (archive.status !== 0) fail("git archive failed");
run("tar", ["-x", "-C", tree], repo, archive.stdout);
for (const rel of EXCLUDE) fs.rmSync(path.join(tree, rel), { recursive: true, force: true });
for (const dir of PRIVATE_IMAGES) {
  if (!fs.existsSync(path.join(tree, dir))) continue;
  for (const rel of walk(path.join(tree, dir))) if (IMAGE.test(rel)) fs.rmSync(path.join(tree, dir, rel));
}

// 2. Leak scan: any text file with a listed name stops the publish.
const leaks: string[] = [];
for (const rel of walk(tree)) {
  const data = fs.readFileSync(path.join(tree, rel));
  if (data.subarray(0, 8000).includes(0)) continue;
  const text = data.toString("utf8");
  for (const pattern of LEAKS) {
    const match = pattern.exec(text);
    if (!match) continue;
    // Base64 blobs can contain any letters; only count matches outside long base64 runs.
    const around = text.slice(Math.max(0, match.index - 40), match.index + 40);
    if (/[A-Za-z0-9+/]{60,}/.test(around)) continue;
    leaks.push(`${rel}: ${pattern}`);
  }
}
if (leaks.length) fail(`refusing to publish, these files still name private things:\n  ${leaks.join("\n  ")}`);

// 3. Commit the tree on top of the public repo.
const pub = path.join(work, "public");
const cloned = spawnSync("git", ["clone", "--depth", "1", PUBLIC_REMOTE, pub], { stdio: "ignore" });
if (cloned.status !== 0) {
  fs.mkdirSync(pub, { recursive: true });
  run("git", ["init", "-q", "-b", "main"], pub);
  run("git", ["remote", "add", "origin", PUBLIC_REMOTE], pub);
}
for (const entry of fs.readdirSync(pub)) if (entry !== ".git") fs.rmSync(path.join(pub, entry), { recursive: true, force: true });
fs.cpSync(tree, pub, { recursive: true });
run("git", ["add", "-A"], pub);
if (!run("git", ["status", "--porcelain"], pub)) {
  process.stdout.write("publish: the public repo already matches this ref\n");
  process.exit(0);
}
const [name, email] = [AUTHOR.replace(/ <.*/, ""), AUTHOR.replace(/.*<|>/g, "")];
run(
  "git",
  ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-q", "--author", AUTHOR, "-m", `Easy Job ${version} (${source})`],
  pub,
);
const files = walk(pub).length;
if (dryRun) {
  process.stdout.write(`publish: dry run, ${files} files ready in ${pub}\n`);
  process.exit(0);
}
run("git", ["push", "origin", "HEAD:main"], pub);
process.stdout.write(`publish: Easy Job ${version} (${source}) pushed to ${PUBLIC_REMOTE}, ${files} files\n`);
