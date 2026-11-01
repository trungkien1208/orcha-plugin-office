import { demoSnapshot, startFakeOrcha } from "./fake-orcha.ts";
import { startServer } from "../src/http/server.ts";
import { startLink } from "../src/orcha/link.ts";
import { connect } from "../src/orcha/transport.ts";
import { openActivity } from "../src/state/activity.ts";
import { loadLocal } from "../src/state/local.ts";
import { emptyOffice, type Agent, type OfficeState, type SessionSnapshot } from "@easy-job/shared";
import { OrchaError } from "../src/orcha/client.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dir, "fixtures/snapshot-live.json"), "utf8"),
) as { result: { snapshot: SessionSnapshot } };

describe("fake Orcha actions", () => {
  test("answer, prompt and start reach the recorded methods", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-fake-"));
    const fake = await startFakeOrcha({
      socketPath: path.join(dir, "herdr.sock"),
      snapshot: demoSnapshot(fixture.result.snapshot),
    });
    const link = startLink({
      connect: () => connect(fake.socketPath),
      socketPath: fake.socketPath,
      local: loadLocal(path.join(dir, "state.json")),
      activity: openActivity(path.join(dir, "activity.jsonl")),
      debounceMs: 0,
      backoffStartMs: 0,
    });
    const server = startServer({
      link,
      activity: openActivity(path.join(dir, "activity-2.jsonl")),
      distDir: dir,
      port: 18000 + (process.pid % 10000),
      open: false,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const headers = { authorization: `Bearer ${server.token}`, "content-type": "application/json" };
    try {
      let state: OfficeState | null = null;
      for (let i = 0; i < 40 && !state?.orcha.connected; i += 1) {
        const response = await fetch(`${base}/api/state`, { headers });
        state = (await response.json()) as OfficeState;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(state?.orcha.connected).toBe(true);
      const blocked = state?.agents.find((agent) => agent.name === "Headset");
      expect(blocked?.status).toBe("blocked");
      if (!blocked) throw new Error("missing Headset");
      const pane = encodeURIComponent(blocked.paneId);
      const answer = await fetch(`${base}/api/agents/${pane}/answer`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "yes please" }),
      });
      expect(answer.status).toBe(200);
      const prompt = await fetch(`${base}/api/agents/${pane}/prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "continue" }),
      });
      expect(prompt.status).toBe(409);
      const project = state?.projects[0]?.workspaceId;
      const started = await fetch(`${base}/api/projects/${encodeURIComponent(project ?? "")}/agents`, {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "claude", name: "Scratch", prompt: "hello" }),
      });
      expect(started.status).toBe(200);
      expect(fake.calls.map((call) => call.method)).toEqual(
        expect.arrayContaining(["pane.send_input", "agent.prompt", "tab.create", "agent.start"]),
      );
      const sent = fake.calls.find((call) => call.method === "pane.send_input");
      expect(sent?.params).toMatchObject({ text: "yes please", keys: ["enter"] });
      const renamed = await fetch(`${base}/api/agents/${pane}/rename`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Headphone" }),
      });
      expect(renamed.status).toBe(200);
      let named = "";
      for (let i = 0; i < 40 && named !== "Headphone"; i += 1) {
        const response = await fetch(`${base}/api/state`, { headers });
        const next = (await response.json()) as OfficeState;
        named = next.agents.find((agent) => agent.paneId === blocked.paneId)?.name ?? "";
        await Bun.sleep(25);
      }
      expect(named).toBe("Headphone");
    } finally {
      server.stop();
      link.stop();
      await fake.close();
    }
  });

  test("start agent appears in state", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-start-"));
    const fake = await startFakeOrcha({
      socketPath: path.join(dir, "herdr.sock"),
      snapshot: demoSnapshot(fixture.result.snapshot),
    });
    const link = startLink({
      connect: () => connect(fake.socketPath),
      socketPath: fake.socketPath,
      local: loadLocal(path.join(dir, "state.json")),
      activity: openActivity(path.join(dir, "activity.jsonl")),
      debounceMs: 0,
      backoffStartMs: 0,
    });
    const server = startServer({
      link,
      activity: openActivity(path.join(dir, "activity-2.jsonl")),
      distDir: dir,
      port: 19000 + (process.pid % 10000),
      open: false,
    });
    const base = `http://127.0.0.1:${server.port}`;
    const headers = { authorization: `Bearer ${server.token}`, "content-type": "application/json" };
    try {
      let state: OfficeState | null = null;
      for (let i = 0; i < 40 && !state?.orcha.connected; i += 1) {
        state = (await (await fetch(`${base}/api/state`, { headers })).json()) as OfficeState;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const before = state?.agents.length ?? 0;
      const project = state?.projects[0]?.workspaceId ?? "";
      const started = await fetch(`${base}/api/projects/${encodeURIComponent(project)}/agents`, {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "claude", name: "Carry" }),
      });
      expect(started.status).toBe(200);
      const body = (await started.json()) as { paneId?: string };
      let appeared: OfficeState["agents"][number] | undefined;
      for (let i = 0; i < 40 && !appeared; i += 1) {
        state = (await (await fetch(`${base}/api/state`, { headers })).json()) as OfficeState;
        appeared = state.agents.find((agent) => agent.paneId === body.paneId);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(appeared?.name).toBe("Carry");
      expect(appeared?.kind).toBe("claude");
      expect(appeared?.status).toBe("idle");
      expect(appeared?.session?.value).toBe(`sess-${body.paneId}`);
      expect(appeared?.workspaceId).toBe(project);
      expect(state?.agents.length).toBe(before + 1);
      expect(body.paneId?.startsWith(`${project}:`)).toBe(true);
      expect(body.paneId).not.toBe("w1:p9");
    } finally {
      server.stop();
      link.stop();
      await fake.close();
    }
  });

  test("a prompt says when Orcha isn't answering", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-down-"));
    const agent = {
      paneId: "p1",
      workspaceId: "w1",
      tabId: "t1",
      kind: "claude",
      name: "Ada",
      status: "idle",
      orchaStatus: "idle",
      stateChangeSeq: 1,
      agentKey: "ada",
      skin: "headset",
      interactiveReady: true,
      launchPending: false,
      focused: false,
    } satisfies Agent;
    const office: OfficeState = { ...emptyOffice("/tmp/sock"), orcha: { connected: true, socketPath: "/tmp/sock" }, agents: [agent] };
    let failure: unknown = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const link: OfficeLink = {
      state: () => office,
      request: async () => {
        throw failure;
      },
      reemit() {},
      updateLocal() {},
      dropSocket() {},
      stop() {},
    };
    const server = startServer({
      link,
      activity: openActivity(path.join(dir, "activity.jsonl")),
      distDir: dir,
      port: 32000 + (process.pid % 1000),
      open: false,
    });
    const headers = { authorization: `Bearer ${server.token}`, "content-type": "application/json" };
    const prompt = () =>
      fetch(`http://127.0.0.1:${server.port}/api/agents/p1/prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "hello" }),
      });
    try {
      const refused = await prompt();
      expect(refused.status).toBe(503);
      expect(await refused.json()).toEqual({ error: "Orcha isn't answering" });
      failure = new OrchaError("timeout", "Orcha did not answer agent.prompt");
      const slow = await prompt();
      expect(slow.status).toBe(503);
      expect(await slow.json()).toEqual({ error: "Orcha isn't answering" });
      failure = Object.assign(new Error("connect ENOENT"), { code: "ENOENT" });
      const missing = await prompt();
      expect(missing.status).toBe(503);
      expect(await missing.json()).toEqual({ error: "Orcha isn't answering" });
    } finally {
      server.stop();
    }
  });
});
