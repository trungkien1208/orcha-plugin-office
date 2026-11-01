import { describe, expect, test } from "bun:test";
import type { SessionSnapshot } from "@easy-job/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { launchAgentPlist, startViaOrcha } from "../src/cli.ts";
import { startOrchaServer } from "../src/http/routes.ts";
import { commandFor, webDistDir } from "../src/paths.ts";
import { manifestFiles, runDoctor } from "../src/doctor.ts";
import { resolveSocketPath } from "../src/orcha/transport.ts";
import { hideOwn } from "../src/state/hide.ts";
import { startFakeOrcha } from "./fake-orcha.ts";

const snap = (): SessionSnapshot => ({
  workspaces: [
    { workspace_id: "w1", label: "acme", number: 1 } as SessionSnapshot["workspaces"][number],
    { workspace_id: "w8", label: "Easy Job", number: 8 } as SessionSnapshot["workspaces"][number],
    { workspace_id: "w9", label: "Easy Job bridge", number: 9, tokens: { easy_job: "bridge" } } as unknown as SessionSnapshot["workspaces"][number],
  ],
  panes: [
    { pane_id: "w1:p1", workspace_id: "w1" } as SessionSnapshot["panes"][number],
    { pane_id: "w9:p1", workspace_id: "w9" } as SessionSnapshot["panes"][number],
    { pane_id: "w9:p2", workspace_id: "w9" } as SessionSnapshot["panes"][number],
  ],
  agents: [{ pane_id: "w1:p1", workspace_id: "w1" } as SessionSnapshot["agents"][number]],
});

describe("Easy Job hides itself", () => {
  test("the tagged host workspace and the bridge pane never reach the Floor; a Project the user named Easy Job stays", () => {
    const out = hideOwn(snap(), "w9:p2");
    expect(out.workspaces.map((w) => w.workspace_id)).toEqual(["w1", "w8"]);
    expect(out.panes.map((p) => p.pane_id)).toEqual(["w1:p1"]);
    expect(out.agents).toHaveLength(1);
  });
  test("nothing to hide returns the same snapshot", () => {
    const input = { ...snap(), workspaces: snap().workspaces.slice(0, 2), panes: snap().panes.slice(0, 1) };
    expect(hideOwn(input)).toBe(input);
  });
});

describe("cli helpers", () => {
  test("EASY_JOB_SOCKET wins, the old name still works", () => {
    expect(resolveSocketPath({}, { EASY_JOB_SOCKET: "/a.sock", ORCHA_OFFICE_SOCKET: "/b.sock", HOME: "/h" })).toBe("/a.sock");
    expect(resolveSocketPath({}, { ORCHA_OFFICE_SOCKET: "/b.sock", HOME: "/h" })).toBe("/b.sock");
  });
  test("doctor lists every art file a manifest names", () => {
    expect(manifestFiles({ a: "office/x.png", b: ["office/y.png", "nope"], c: { d: "office/z.png" }, n: 3 })).toEqual(["office/x.png", "office/y.png", "office/z.png"]);
  });
  test("doctor prints one line when ping reports a protocol other than 22", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-doctor-"));
    const snapshot = { version: "0.9.5", workspaces: [], panes: [], agents: [] } as SessionSnapshot;
    const fake = await startFakeOrcha({ socketPath: path.join(dir, "herdr.sock"), snapshot, pingProtocol: 21 });
    try {
      const checks = await runDoctor({ socketPath: fake.socketPath, home: dir, publicDir: dir });
      expect(checks.find((check) => check.name === "Orcha running")?.ok).toBe(true);
      expect(checks.find((check) => check.name === "Orcha protocol")).toEqual({
        name: "Orcha protocol",
        ok: false,
        detail: "Orcha protocol 21 is untested; some actions may fail",
        fix: "Easy Job still works. Update Orcha or Easy Job.",
      });
    } finally {
      await fake.close();
    }
  });
  test("a compiled binary is the program; a dev run is bun plus the script", () => {
    expect(commandFor("/usr/local/bin/bun", "/usr/local/bin/bun", "/repo/cli.ts")).toEqual(["/usr/local/bin/bun", "/repo/cli.ts"]);
    expect(commandFor("/Users/me/.local/bin/easy-job", "/usr/local/bin/bun", "/repo/cli.ts")).toEqual(["/Users/me/.local/bin/easy-job"]);
  });

  test("a Bun symlink starts the background bridge with the CLI script", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-bun-link-"));
    try {
      const binary = path.join(dir, "bun-real"), link = path.join(dir, "bun");
      fs.writeFileSync(binary, "");
      fs.symlinkSync(binary, link);
      expect(commandFor(binary, link, "/repo/cli.ts")).toEqual([binary, "/repo/cli.ts"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the web build is the folder next to the binary, else the repo dist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-web-"));
    const bin = path.join(dir, "bin");
    fs.mkdirSync(path.join(bin, "easy-job-web"), { recursive: true });
    fs.writeFileSync(path.join(bin, "easy-job-web", "index.html"), "app");
    expect(webDistDir(path.join(bin, "easy-job"), path.join(dir, "packages/bridge/src"))).toBe(path.join(bin, "easy-job-web"));
    expect(webDistDir(path.join(dir, "bun"), path.join(dir, "packages/bridge/src"))).toBe(path.join(dir, "packages/web/dist"));
  });

  test("Start Orcha runs `orcha server` when Orcha is on PATH, and says so when it is not", async () => {
    expect(startOrchaServer("/missing")).toEqual({ started: false, message: "Orcha is not installed. See `easy-job doctor`." });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-orcha-"));
    const marker = path.join(dir, "ran");
    fs.writeFileSync(path.join(dir, "orcha"), `#!/bin/sh\necho "$1" > "${marker}"\n`, { mode: 0o755 });
    const result = startOrchaServer(dir);
    expect(result).toEqual({ started: true, message: "Starting Orcha…" });
    const until = Date.now() + 2000;
    while (!fs.existsSync(marker) && Date.now() < until) await Bun.sleep(20);
    expect(fs.readFileSync(marker, "utf8").trim()).toBe("server");
  });

  test("the LaunchAgent runs serve --no-open and escapes XML", () => {
    const plist = launchAgentPlist(["/bin/bun", "/a&b/cli.ts", "serve", "--no-open"], "/tmp/log");
    expect(plist).toContain("<string>/a&amp;b/cli.ts</string>");
    expect(plist).toContain("<string>--no-open</string>");
    expect(plist).toContain("<key>RunAtLoad</key><true/>");
  });
});

describe("page token", () => {
  test("survives a bridge restart and is private", async () => {
    const { readToken, saveToken, tokenFile } = await import("../src/instance.ts");
    const fs = await import("node:fs");
    const home = fs.mkdtempSync(`${(await import("node:os")).tmpdir()}/ej-token-`);
    expect(readToken(home)).toBeUndefined();
    saveToken(home, "a".repeat(64));
    expect(readToken(home)).toBe("a".repeat(64));
    expect(fs.statSync(tokenFile(home)).mode & 0o777).toBe(0o600);
  });
});

describe("open --via-orcha", () => {
  /** Orcha's rule since plugin v1: a tab pane takes workspace_id, never target_pane_id or direction. */
  function fakeClient(workspaces: Array<{ workspace_id: string; label: string; tokens?: Record<string, string> }>) {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const panes = workspaces.map((ws) => ({ pane_id: `${ws.workspace_id}:p1`, workspace_id: ws.workspace_id }));
    const client = {
      async request(method: string, params: Record<string, unknown> = {}) {
        calls.push({ method, params });
        if (method === "session.snapshot") return { snapshot: { workspaces, panes } };
        if (method === "workspace.create") {
          const ws = { workspace_id: `w${workspaces.length + 1}`, label: String(params.label) };
          workspaces.push(ws);
          panes.push({ pane_id: `${ws.workspace_id}:p1`, workspace_id: ws.workspace_id });
          return { workspace: { workspace_id: ws.workspace_id } };
        }
        if (method === "plugin.pane.open" && params.placement === "tab" && ("target_pane_id" in params || "direction" in params)) {
          throw new Error("tab plugin panes support workspace_id but not target_pane_id or direction");
        }
        return {};
      },
    };
    return { client, calls };
  }

  test("opens the server tab in the existing bridge workspace by workspace_id", async () => {
    const { client, calls } = fakeClient([
      { workspace_id: "w1", label: "acme-superapp" },
      { workspace_id: "w2", label: "Easy Job bridge", tokens: { easy_job: "bridge" } },
    ]);
    await startViaOrcha(client);
    expect(calls.at(-1)).toEqual({ method: "plugin.pane.open", params: { plugin_id: "easy-job", entrypoint: "server", placement: "tab", workspace_id: "w2", focus: false } });
  });

  test("creates and tags the bridge workspace the first time", async () => {
    const { client, calls } = fakeClient([{ workspace_id: "w1", label: "acme-superapp" }]);
    await startViaOrcha(client);
    expect(calls.map((call) => call.method)).toEqual(["session.snapshot", "workspace.create", "session.snapshot", "workspace.report_metadata", "plugin.pane.open"]);
    expect(calls.at(-1)?.params.workspace_id).toBe("w2");
  });
});
