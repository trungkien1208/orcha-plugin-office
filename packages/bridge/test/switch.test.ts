import { emptyOffice, NO_ACCOUNT_API, type Agent } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AccountInfo } from "@easy-job/shared";
import { describeSwitch, linkSession, resumeLine, sessionPath, switchAccount } from "../src/switch.ts";
import { openActivity } from "../src/state/activity.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import type { AccountRoots } from "../src/accounts.ts";

function person(paneId: string, status: Agent["status"]): Agent {
  return {
    paneId, workspaceId: "w1", tabId: "t1", kind: "claude", name: paneId, status, orchaStatus: status,
    stateChangeSeq: 1, agentKey: paneId, skin: "headset", cwd: "/tmp/repo", interactiveReady: true,
    launchPending: false, focused: false, session: { source: "claude", agent: "claude", kind: "id", value: "sess-1" },
  };
}

describe("account switch", () => {
  test("keychain lists the other panes and is refused; restart links the session and does not move it", async () => {
    const accounts: AccountInfo[] = [
      { id: "claude-main", label: "Main", kind: "claude", signedIn: true, active: true, fuel: [], panes: ["p1", "p2"], dir: undefined },
    ];
    const plan = describeSwitch({ agent: person("p1", "idle"), accountId: "claude-main", mode: "keychain", accounts, home: "/tmp" });
    expect(plan).toMatchObject({ mode: "keychain", allowed: false, reason: NO_ACCOUNT_API, alsoMoves: ["p2"], needsIdle: false });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-switch-"));
    const source = path.join(dir, "old.jsonl");
    fs.writeFileSync(source, "{}\n");
    const to = sessionPath(path.join(dir, "next"), "/tmp/repo", "sess-1");
    const linked = linkSession({ from: source, to });
    expect(linked).toEqual({ linked: true, created: true });
    expect(fs.lstatSync(to).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(source)).toBe(true);
    expect(resumeLine("claude", "sess-1", path.join(dir, "next"))).toContain("claude --resume sess-1");
    expect(resumeLine("claude", "sess-1")).toBe("claude --resume sess-1");
    expect(resumeLine("codex", "sess-1")).toBe("codex resume --last --no-daemon");
    expect(resumeLine("cursor", "sess-1")).toBe("cursor-agent resume");
  });

  test("a busy restart is 409 unless it waits, and an idle one sends ctrl-c then the resume line", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-switch-run-"));
    const roots: AccountRoots = { orchaDir: dir, limitsDir: dir, home: dir };
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ accounts: [{ id: "claude-main", kind: "claude", label: "Main" }] }));
    const calls: Array<{ method: string; params: unknown }> = [];
    let agent = person("p1", "working");
    const link = {
      state: () => ({ ...emptyOffice("/tmp/sock"), agents: [agent] }),
      request: async (method: string, params: unknown) => {
        calls.push({ method, params });
        return {};
      },
      reemit() {},
      updateLocal() {},
      dropSocket() {},
      stop() {},
    } as unknown as OfficeLink;
    const activity = openActivity(path.join(dir, "activity.jsonl"));
    await expect(switchAccount({ link, agent, accountId: "claude-main", mode: "keychain", roots, activity, waitMs: 0 })).rejects.toMatchObject({ status: 501 });
    await expect(switchAccount({ link, agent, accountId: "claude-main", mode: "restart", roots, activity, waitMs: 0 })).rejects.toMatchObject({ status: 409 });
    const queued = await switchAccount({ link, agent, accountId: "claude-main", mode: "restart", whenIdle: true, roots, activity, waitMs: 0 });
    expect(queued).toEqual({ ok: true, paneId: "p1" });
    expect(calls).toEqual([]);
    agent = { ...agent, status: "idle" };
    const { flushSwitches } = await import("../src/switch.ts");
    await flushSwitches({ link, agents: [agent], roots, activity, waitMs: 0 });
    expect(calls.map((call) => call.method)).toEqual(["agent.send_keys", "pane.send_input"]);
    expect(calls[0]?.params).toMatchObject({ keys: ["ctrl-c", "ctrl-c"] });
    expect(calls[1]?.params).toMatchObject({ text: "claude --resume sess-1", keys: ["enter"] });
  });
});
