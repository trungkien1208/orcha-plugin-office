import { emptyOffice, fuelIsLow, NO_ACCOUNT_API, officeCapabilities, planSwitch, type Agent, type OfficeState } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer } from "../src/http/server.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { openActivity } from "../src/state/activity.ts";

function agent(paneId: string, status: Agent["status"]): Agent {
  return {
    paneId,
    workspaceId: "w1",
    tabId: "t1",
    kind: "claude",
    name: paneId,
    status,
    orchaStatus: status,
    stateChangeSeq: 1,
    agentKey: paneId,
    skin: "headset",
    interactiveReady: true,
    launchPending: false,
    focused: false,
    lowFuel: false,
  };
}

function office(): OfficeState {
  const state = emptyOffice("/tmp/sock");
  state.agents = [agent("idle", "idle"), agent("busy", "working"), agent("ask", "blocked")];
  return state;
}

function rig() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-contract-"));
  const state = office();
  const link: OfficeLink = {
    state: () => state,
    request: async () => {
      throw new Error("no orcha");
    },
    reemit() {},
    updateLocal() {},
    dropSocket() {},
    stop() {},
  };
  const server = startServer({
    link,
    activity: openActivity(path.join(home, "activity.jsonl")),
    distDir: home,
    port: 38000 + (process.pid % 1000),
    open: false,
    token: "contract-token",
    accountRoots: { orchaDir: home, limitsDir: path.join(home, "limits"), home },
    accountPollMs: 60_000,
  });
  const headers = { authorization: "Bearer contract-token", "content-type": "application/json" };
  return { server, headers, home, stop: () => server.stop() };
}

describe("account contract builders", () => {
  test("capabilities stay off the Keychain, and low fuel is the 5-hour window under 10%", () => {
    expect(officeCapabilities(false)).toEqual({ accountApi: false, handoff: false });
    expect(officeCapabilities(true)).toEqual({ accountApi: false, handoff: true });
    expect(fuelIsLow([{ key: "session", label: "5H", left: 9 }])).toBe(true);
    expect(fuelIsLow([{ key: "session", label: "5H", left: 10 }])).toBe(false);
    expect(fuelIsLow([{ key: "weekly", label: "WEEK", left: 1 }])).toBe(false);
  });

  test("a keychain plan is refused, a restart plan is a dry run, hand off needs the script", () => {
    expect(planSwitch({ mode: "keychain", alsoMoves: ["p2"] })).toEqual({
      mode: "keychain",
      allowed: false,
      reason: NO_ACCOUNT_API,
      alsoMoves: ["p2"],
      needsIdle: false,
    });
    expect(planSwitch({ mode: "restart", needsIdle: true, sessionLinked: false })).toMatchObject({
      mode: "restart",
      allowed: true,
      needsIdle: true,
      sessionLinked: false,
    });
    expect(planSwitch({ mode: "handoff", handoff: false }).allowed).toBe(false);
    expect(planSwitch({ mode: "handoff", handoff: true }).allowed).toBe(true);
  });
});

describe("account contract routes", () => {
  test("stubs return the contract shapes and do not switch a keychain", async () => {
    const { server, headers, home, stop } = rig();
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ accounts: [{ id: "claude-work", kind: "claude", label: "Work" }] }));
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const accounts = await (await fetch(`${base}/api/accounts`, { headers })).json();
      expect(Array.isArray(accounts)).toBe(true);
      expect(JSON.stringify(accounts)).not.toContain("token");
      const model = await fetch(`${base}/api/agents/busy/model`, { method: "POST", headers, body: JSON.stringify({ model: "opus" }) });
      expect(model.status).toBe(200);
      expect(await model.json()).toEqual({ queued: true });
      const blocked = await fetch(`${base}/api/agents/ask/model`, { method: "POST", headers, body: JSON.stringify({ model: "opus" }) });
      expect(blocked.status).toBe(409);
      const bad = await fetch(`${base}/api/agents/idle/model`, { method: "POST", headers, body: JSON.stringify({ model: "has space" }) });
      expect(bad.status).toBe(400);
      const plan = await fetch(`${base}/api/agents/busy/account/plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accountId: "claude-work", mode: "restart" }),
      });
      expect(await plan.json()).toMatchObject({ mode: "restart", allowed: true, needsIdle: true });
      const key = await fetch(`${base}/api/agents/idle/account`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accountId: "claude-work", mode: "keychain" }),
      });
      expect(key.status).toBe(501);
      expect(await key.json()).toEqual({ error: NO_ACCOUNT_API });
      const busy = await fetch(`${base}/api/agents/busy/account`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accountId: "claude-work", mode: "restart" }),
      });
      expect(busy.status).toBe(409);
      const hand = await fetch(`${base}/api/agents/idle/handoff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: { kind: "codex" }, mode: "summary" }),
      });
      expect(hand.status).toBe(501);
      const team = await fetch(`${base}/api/projects/w1/prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: ["idle", "busy"], text: "look here" }),
      });
      expect(await team.json()).toEqual({
        results: [
          { paneId: "idle", ok: false, error: "no orcha" },
          { paneId: "busy", ok: false, error: "no orcha" },
        ],
      });
      expect(await (await fetch(`${base}/api/projects/w1/thread`, { headers })).json()).toEqual({ items: [] });
    } finally {
      stop();
    }
  });
});
