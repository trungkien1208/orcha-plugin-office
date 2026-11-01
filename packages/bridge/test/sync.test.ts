import type { ActivityEntry, Project } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { answerAgent, promptAgent } from "../src/actions.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { claimBridge, pidAlive, readBridge, releaseBridge } from "../src/instance.ts";
import { openActivity } from "../src/state/activity.ts";
import { doneToday } from "../src/state/kpi.ts";
import { appendLog } from "../src/state/log.ts";
import { pruneUploads, saveUpload } from "../src/uploads.ts";

function tempHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-sync-"));
}

describe("done today", () => {
  test("counts finishes since local midnight, top 5", () => {
    const now = new Date(2026, 9, 30, 15, 0, 0).getTime();
    const midnight = new Date(2026, 9, 30, 0, 0, 0).getTime();
    const projects = [
      { workspaceId: "w1", label: "alpha" },
      { workspaceId: "w2", label: "beta" },
    ] as Project[];
    const entries: ActivityEntry[] = [
      { id: "1", at: midnight - 1000, kind: "status", text: "alpha · A → done", workspaceId: "w1" },
      { id: "2", at: midnight + 1000, kind: "status", text: "alpha · A → done", workspaceId: "w1" },
      { id: "3", at: midnight + 2000, kind: "status", text: "alpha · B → done", workspaceId: "w1" },
      { id: "4", at: midnight + 3000, kind: "status", text: "beta · C → done", workspaceId: "w2" },
      { id: "5", at: midnight + 4000, kind: "status", text: "alpha · A → working", workspaceId: "w1" },
    ];
    expect(doneToday(entries, projects, now)).toEqual([
      { workspaceId: "w1", label: "alpha", count: 2 },
      { workspaceId: "w2", label: "beta", count: 1 },
    ]);
  });
});

describe("single instance", () => {
  test("bridge.json is private and a dead pid is not treated as live", () => {
    const home = tempHome();
    claimBridge(home, { pid: process.pid, port: 4317, token: "abc", bridgeId: "bridge-1" });
    expect(readBridge(home)?.token).toBe("abc");
    expect(fs.statSync(home).mode & 0o777).toBe(0o700);
    expect(fs.statSync(path.join(home, "bridge.json")).mode & 0o777).toBe(0o600);
    expect(pidAlive(process.pid)).toBe(false);
    expect(pidAlive(1)).toBe(true);
    releaseBridge(home, process.pid);
    expect(readBridge(home)).toBeNull();
  });
});

describe("uploads", () => {
  test("files older than 7 days are removed on start", () => {
    const home = tempHome();
    const saved = saveUpload({ paneId: "w1:p1", name: "note.txt", type: "text/plain", bytes: new TextEncoder().encode("hi"), home });
    const old = saved.path;
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(old, past, past);
    pruneUploads(home);
    expect(fs.existsSync(old)).toBe(false);
  });
});

describe("logs", () => {
  test("the bridge log rotates and does not need the transcript", () => {
    const home = tempHome();
    appendLog(home, "bridge started", 32);
    appendLog(home, "x".repeat(40), 32);
    const dir = path.join(home, "logs");
    expect(fs.readdirSync(dir).some((name) => name.startsWith("bridge.log"))).toBe(true);
    const body = fs.readdirSync(dir).map((name) => fs.readFileSync(path.join(dir, name), "utf8")).join("\n");
    expect(body.includes("HEAD-SECRET")).toBe(false);
  });
});

describe("action queue", () => {
  test("two prompts for one Agent do not interleave", async () => {
    const calls: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const link = {
      state: () => ({
        agents: [{ paneId: "p", name: "Headset", status: "idle", agentKey: "k", workspaceId: "w1" }],
        projects: [],
      }),
      request: async (method: string) => {
        calls.push(method);
        if (calls.length === 1) await gate;
        return {};
      },
      updateLocal() {},
      reemit() {},
      stop() {},
      dropSocket() {},
    } as unknown as OfficeLink;
    const activity = openActivity(path.join(tempHome(), "activity.jsonl"));
    const first = promptAgent(link, "p", "one", activity);
    const second = answerAgent(link, "p", "two", activity);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(calls).toEqual(["agent.prompt"]);
    release();
    await Promise.all([first, second]);
    expect(calls).toEqual(["agent.prompt", "pane.send_input"]);
  });
});
