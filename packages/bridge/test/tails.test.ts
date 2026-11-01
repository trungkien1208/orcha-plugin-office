import { emptyOffice, type Agent, type ClientMessage, type OfficeState, type ServerMessage } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeSlug } from "../src/conversation/load.ts";
import { startServer, type OfficeServer } from "../src/http/server.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { openActivity } from "../src/state/activity.ts";

const cwd = "/tmp/easy-job-tail";
let portCursor = 28000 + (process.pid % 1000);

function agent(session: string): Agent {
  return {
    paneId: "p1",
    workspaceId: "w1",
    tabId: "t1",
    kind: "claude",
    name: "Ada",
    status: "idle",
    orchaStatus: "idle",
    stateChangeSeq: 1,
    agentKey: session,
    skin: "headset",
    cwd,
    session: { source: "claude", agent: "claude", kind: "session", value: session },
    interactiveReady: true,
    launchPending: false,
    focused: false,
  };
}

function stateWith(session: string): OfficeState {
  const base = emptyOffice("/tmp/sock");
  return { ...base, orcha: { ...base.orcha, connected: true }, agents: [agent(session)] };
}

function writeSession(home: string, session: string, text: string) {
  const dir = path.join(home, ".claude", "projects", claudeSlug(cwd));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${session}.jsonl`),
    `${JSON.stringify({ type: "user", timestamp: "2026-10-30T05:00:00.000Z", uuid: text, message: { role: "user", content: text } })}\n`,
  );
}

function harness(session: string, timings?: { retryMs?: number; giveUpMs?: number }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-tail-"));
  let state = stateWith(session);
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
    port: portCursor++,
    open: false,
    token: "t".repeat(64),
    transcriptHome: home,
    transcriptRetryMs: timings?.retryMs,
    transcriptGiveUpMs: timings?.giveUpMs,
  });
  return {
    home,
    server,
    setSession(next: string) {
      state = stateWith(next);
    },
    clearAgents() {
      state = { ...state, agents: [] };
    },
  };
}

async function waitFor(check: () => boolean, label: string) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 2000) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function connectClient(server: OfficeServer) {
  const messages: ServerMessage[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, [`easy-job.${server.token}`]);
  ws.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)) as ServerMessage);
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("websocket failed")));
  });
  await waitFor(() => messages.some((message) => message.type === "hello"), "hello");
  return {
    messages,
    send(body: ClientMessage) {
      ws.send(JSON.stringify(body));
    },
    close() {
      ws.close();
    },
  };
}

function conversations(messages: ServerMessage[]) {
  return messages.filter((message) => message.type === "conversation");
}

describe("conversation tails", () => {
  test("a new session closes the old watch and resets the transcript", async () => {
    const rig = harness("sess-a");
    writeSession(rig.home, "sess-a", "alpha");
    writeSession(rig.home, "sess-b", "beta");
    const client = await connectClient(rig.server);
    try {
      client.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => conversations(client.messages).some((message) => message.items.some((item) => item.text === "alpha")), "alpha");
      rig.setSession("sess-b");
      await waitFor(
        () => conversations(client.messages).some((message) => message.reset && message.items.some((item) => item.text === "beta")),
        "beta reset",
      );
      const reset = conversations(client.messages).find((message) => message.reset);
      expect(reset?.items.some((item) => item.text === "alpha")).toBe(false);
    } finally {
      client.close();
      rig.server.stop();
    }
  });

  test("the last unwatch or disconnect closes the tail", async () => {
    const rig = harness("sess-a");
    writeSession(rig.home, "sess-a", "alpha");
    const first = await connectClient(rig.server);
    const second = await connectClient(rig.server);
    try {
      first.send({ type: "watch-conversation", paneId: "p1" });
      second.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => rig.server.openTails() === 1, "one tail");
      first.send({ type: "unwatch-conversation", paneId: "p1" });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(rig.server.openTails()).toBe(1);
      second.close();
      await waitFor(() => rig.server.openTails() === 0, "tail released");
      rig.setSession("sess-b");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(conversations(first.messages).some((message) => message.reset)).toBe(false);
    } finally {
      first.close();
      rig.server.stop();
    }
  });

  test("a missing transcript is retried until it appears, then given up", async () => {
    const found = harness("sess-new", { retryMs: 20, giveUpMs: 500 });
    const client = await connectClient(found.server);
    try {
      client.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => found.server.openTails() === 1, "watching");
      writeSession(found.home, "sess-new", "arrived");
      await waitFor(
        () => conversations(client.messages).some((message) => message.reset && message.items.some((item) => item.text === "arrived")),
        "arrived",
      );
    } finally {
      client.close();
      found.server.stop();
    }

    const late = harness("sess-late", { retryMs: 15, giveUpMs: 40 });
    const other = await connectClient(late.server);
    try {
      other.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => late.server.openTails() === 1, "watching late");
      await new Promise((resolve) => setTimeout(resolve, 120));
      writeSession(late.home, "sess-late", "too late");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(conversations(other.messages).some((message) => message.items.some((item) => item.text === "too late"))).toBe(false);
    } finally {
      other.close();
      late.server.stop();
    }
  });

  test("a tail is released when its agent is gone", async () => {
    const rig = harness("sess-a");
    writeSession(rig.home, "sess-a", "alpha");
    const client = await connectClient(rig.server);
    try {
      client.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => conversations(client.messages).some((message) => message.items.some((item) => item.text === "alpha")), "alpha");
      rig.clearAgents();
      await waitFor(
        () => conversations(client.messages).some((message) => message.reset && message.items.length === 0) && rig.server.openTails() === 0,
        "tail released",
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(rig.server.openTails()).toBe(0);
    } finally {
      client.close();
      rig.server.stop();
    }
  });

  test("an agent with no transcript polls only the visible screen and stops on unwatch", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-tail-"));
    let text = "one";
    let reads = 0;
    const sources: string[] = [];
    const base = emptyOffice("/tmp/sock");
    const quiet = agent("unused");
    quiet.session = undefined;
    const state: OfficeState = { ...base, orcha: { ...base.orcha, connected: true }, agents: [quiet] };
    const link: OfficeLink = {
      state: () => state,
      request: async (method, params) => {
        if (method === "agent.read") {
          sources.push((params as { source: string }).source);
          reads += 1;
          return { read: { text } };
        }
        throw new Error(method);
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
      port: portCursor++,
      open: false,
      token: "t".repeat(64),
      transcriptHome: home,
      terminalPollMs: 30,
    });
    const client = await connectClient(server);
    try {
      client.send({ type: "watch-conversation", paneId: "p1" });
      await waitFor(() => conversations(client.messages).some((message) => message.items.some((item) => item.text === "one")), "terminal one");
      expect(conversations(client.messages).find((message) => message.items.some((item) => item.text === "one"))?.terminal).toBe(true);
      text = "two";
      await waitFor(
        () => conversations(client.messages).some((message) => message.reset && message.items.some((item) => item.text === "two")),
        "terminal two",
      );
      const before = conversations(client.messages).length;
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(conversations(client.messages).length).toBe(before);
      client.send({ type: "unwatch-conversation", paneId: "p1" });
      await waitFor(() => server.openTails() === 0, "terminal tail released");
      const readsAtStop = reads;
      text = "three";
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(reads).toBe(readsAtStop);
      expect(reads).toBeGreaterThan(1);
      expect(new Set(sources)).toEqual(new Set(["visible"]));
      expect(conversations(client.messages).some((message) => message.items.some((item) => item.text === "three"))).toBe(false);
    } finally {
      client.close();
      server.stop();
    }
  });
});
