import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileDiff, gitContext, readFuel, readRepoFile, repoImage, walkFiles } from "../src/context.ts";

describe("fuel", () => {
  test("Orcha's cache holds percent used; fuel is what is left", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-limits-"));
    fs.writeFileSync(path.join(dir, "codex.json"), JSON.stringify({ session: [98, 1793356703], weekly: [67, 1793774782], note: "as of Codex's last run" }));
    const fuel = readFuel("codex", dir);
    expect(fuel?.windows.map((w) => [w.label, w.left])).toEqual([["5H", 2], ["WEEK", 33]]);
    expect(fuel?.windows[0]?.resetAt).toBe(1793356703000);
    expect(readFuel("missing", dir)).toBeNull();
  });
});

describe("git context", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "ej-repo-"));
  const git = (...args: string[]) => Bun.spawnSync(["git", ...args], { cwd: repo, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  git("init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "a.txt"), "one\n");
  git("add", ".");
  git("commit", "-q", "-m", "first");
  fs.writeFileSync(path.join(repo, "a.txt"), "one\ntwo\n");
  fs.writeFileSync(path.join(repo, "new.txt"), "x\n");

  test("branch, changes with line counts, history", async () => {
    const ctx = await gitContext(repo);
    expect(ctx?.branch).toBe("main");
    expect(ctx?.changes.find((c) => c.path === "a.txt")).toMatchObject({ status: "M", add: 1, del: 0 });
    expect(ctx?.changes.find((c) => c.path === "new.txt")?.status).toBe("A");
    expect(ctx?.history[0]?.subject).toBe("first");
  });
  test("files outside the repo are refused", () => {
    expect(readRepoFile(repo, "a.txt")?.text).toContain("two");
    expect(readRepoFile(repo, "../../etc/passwd")).toBeNull();
    expect(readRepoFile(repo, "/etc/passwd")).toBeNull();
  });
  test("diffs are unified, including a new untracked file", async () => {
    expect(await fileDiff(repo, "a.txt")).toContain("@@");
    const added = await fileDiff(repo, "new.txt");
    expect(added).toContain("--- /dev/null");
    expect(added).toContain("@@ -0,0 +1,1 @@\n+x");
  });
  test("a folder that is not a repo has no context", async () => {
    expect(await gitContext(fs.mkdtempSync(path.join(os.tmpdir(), "ej-plain-")))).toBeNull();
  });
});

describe("files outside git", () => {
  test("a plain folder is walked, skipping hidden and dependency folders, up to the cap", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-walk-"));
    for (const file of ["b.txt", "src/a.ts", "src/deep/c.ts", ".env", ".git/HEAD", "node_modules/x/index.js"]) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), "x");
    }
    expect(await walkFiles(dir)).toEqual(["b.txt", "src/a.ts", "src/deep/c.ts"]);
    expect(await walkFiles(dir, 2)).toHaveLength(2);
  });
});

describe("repo images", () => {
  test("only image files inside the folder are served", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-img-"));
    fs.writeFileSync(path.join(dir, "shot.png"), "png");
    fs.writeFileSync(path.join(dir, "notes.txt"), "text");
    expect(repoImage(dir, "shot.png")?.type).toBe("image/png");
    expect(repoImage(dir, "notes.txt")).toBeNull();
    expect(repoImage(dir, "../shot.png")).toBeNull();
  });
});
