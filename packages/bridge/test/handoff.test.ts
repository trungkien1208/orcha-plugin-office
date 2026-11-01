import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handoffReady, runHandoff } from "../src/handoff.ts";

describe("hand off", () => {
  test("the script runs with the Orcha binary and the account folder, and names the new pane", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-handoff-"));
    const scriptDir = path.join(dir, "scripts");
    fs.mkdirSync(scriptDir);
    const log = path.join(dir, "log");
    fs.writeFileSync(path.join(scriptDir, "handoff.py"), `import os, sys\nopen(${JSON.stringify(log)}, "w").write(os.environ.get("HERDR_BIN_PATH","")+"\\n"+os.environ.get("CLAUDE_CONFIG_DIR","")+"\\n"+" ".join(sys.argv[1:]))\nprint("pane w1:p9")\n`);
    expect(handoffReady(dir)).toBe(true);
    const result = await runHandoff({
      paneId: "w1:p1",
      kind: "claude",
      mode: "summary",
      orchaDir: dir,
      orchaBin: "/tmp/orcha",
      configDir: "/tmp/work",
    });
    expect(result).toEqual({ paneId: "w1:p9" });
    expect(fs.readFileSync(log, "utf8")).toBe("/tmp/orcha\n/tmp/work\nw1:p1 claude summary");
  });

  test("a missing script is refused", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-handoff-miss-"));
    expect(handoffReady(dir)).toBe(false);
    await expect(runHandoff({ paneId: "p", kind: "codex", mode: "full", orchaDir: dir, orchaBin: "orcha" })).rejects.toMatchObject({ status: 501 });
  });
});
