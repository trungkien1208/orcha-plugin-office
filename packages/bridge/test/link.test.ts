import { emptyLocal, type OrchaLine, type SessionSnapshot } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { connect, type Conn } from "../src/orcha/transport.ts";
import { startLink } from "../src/orcha/link.ts";
import { startFakeOrcha } from "./fake-orcha.ts";
import { openActivity } from "../src/state/activity.ts";
import { loadLocal, writeAtomic } from "../src/state/local.ts";

const fixtures = path.join(import.meta.dir, "fixtures");

function readLines(name: string): OrchaLine[] {
  return fs
    .readFileSync(path.join(fixtures, name), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as OrchaLine);
}

class Pipe {
  private inbox: unknown[] = [];
  private waiters: Array<(value: unknown | null) => void> = [];
  closed = false;

  push(value: unknown): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter(value);
    else this.inbox.push(value);
  }

  pull(): Promise<unknown | null> {
    const next = this.inbox.shift();
    if (next !== undefined) return Promise.resolve(next);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  end(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter(null);
  }
}

class MockConn implements Conn {
  readonly fromClient = new Pipe();
  readonly toClient = new Pipe();
  send(value: unknown): void {
    this.fromClient.push(value);
  }
  next(): Promise<unknown | null> {
    return this.toClient.pull();
  }
  close(): void {
    this.fromClient.end();
    this.toClient.end();
  }
  deliver(value: unknown): void {
    this.toClient.push(value);
  }
}

type Sub = { type: string; pane_id?: string };

class MockOrcha {
  snapshot: SessionSnapshot;
  statusSubs: string[][] = [];
  lifecycles: MockConn[] = [];
  snapshots = 0;
  rejectStatus = 0;

  constructor(snapshot: SessionSnapshot) {
    this.snapshot = snapshot;
  }

  connect = async (): Promise<Conn> => {
    const conn = new MockConn();
    void this.serve(conn);
    return conn;
  };

  private async serve(conn: MockConn) {
    const message = (await conn.fromClient.pull()) as {
      id?: string;
      method?: string;
      params?: { subscriptions?: Sub[] };
    } | null;
    if (!message) return;
    if (message.method === "session.snapshot") {
      this.snapshots += 1;
      conn.deliver({
        id: message.id,
        result: { type: "session_snapshot", snapshot: structuredClone(this.snapshot) },
      });
      conn.close();
      return;
    }
    if (message.method === "events.subscribe") {
      const subscriptions = message.params?.subscriptions ?? [];
      const status = subscriptions.some((item) => item.type === "pane.agent_status_changed");
      if (status && this.rejectStatus > 0) {
        this.rejectStatus -= 1;
        const [rejected] = readLines("events-rejected.ndjson");
        conn.deliver({ ...rejected, id: message.id });
        conn.close();
        return;
      }
      conn.deliver({ id: message.id, result: { type: "subscription_started" } });
      if (status) this.statusSubs.push(subscriptions.map((item) => item.pane_id ?? ""));
      else this.lifecycles.push(conn);
      return;
    }
    // Like a protocol 22 server: unknown methods (server.capabilities) are rejected at once.
    conn.deliver({ id: message.id, error: { code: "invalid_request", message: `unknown method ${message.method}` } });
    conn.close();
  }
}

function tinySnapshot(): SessionSnapshot {
  return {
    version: "0.9.5",
    protocol: 22,
    focused_workspace_id: "w1",
    workspaces: [
      {
        workspace_id: "w1",
        number: 1,
        label: "demo",
        focused: true,
        pane_count: 1,
        tab_count: 1,
        active_tab_id: "w1:t1",
        agent_status: "idle",
      },
    ],
    panes: [{ pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1", cwd: "/tmp/demo", agent_status: "idle" }],
    agents: [
      {
        pane_id: "w1:p1",
        workspace_id: "w1",
        tab_id: "w1:t1",
        agent: "claude",
        agent_status: "idle",
        cwd: "/tmp/demo",
        state_change_seq: 1,
      },
    ],
  };
}

async function waitFor(check: () => boolean, label: string) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 2000) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function tempOffice() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "orcha-office-"));
  return {
    home,
    local: loadLocal(path.join(home, "state.json")),
    activity: openActivity(path.join(home, "activity.jsonl"), 1_700_000_000_000),
  };
}

describe("link", () => {
  test("a new pane changes the status subscription set", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    const office = tempOffice();
    const link = startLink({
      connect: orcha.connect,
      socketPath: "mock",
      local: office.local,
      activity: office.activity,
      debounceMs: 0,
      backoffStartMs: 0,
    });
    try {
      await waitFor(() => orcha.statusSubs.length === 1, "first status subscription");
      expect(orcha.statusSubs[0]).toEqual(["w1:p1"]);
      orcha.snapshot = tinySnapshot();
      orcha.snapshot.panes.push({
        pane_id: "w1:p2",
        workspace_id: "w1",
        tab_id: "w1:t2",
        agent_status: "working",
      });
      orcha.snapshot.agents.push({
        pane_id: "w1:p2",
        workspace_id: "w1",
        tab_id: "w1:t2",
        agent: "codex",
        agent_status: "working",
        state_change_seq: 2,
      });
      const [created] = readLines("events-live.ndjson").filter((line) => line.event === "pane_created");
      if (!created) throw new Error("fixture missing pane_created");
      orcha.lifecycles[0]?.deliver(created);
      await waitFor(() => orcha.statusSubs.some((ids) => ids.includes("w1:p2")), "updated status subscription");
      const latest = orcha.statusSubs.at(-1) ?? [];
      expect(latest.sort()).toEqual(["w1:p1", "w1:p2"]);
    } finally {
      link.stop();
    }
  });

  test("events_lost starts a fresh subscription", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    const office = tempOffice();
    const waiting: boolean[] = [];
    const link = startLink({
      connect: orcha.connect,
      socketPath: "mock",
      local: office.local,
      activity: office.activity,
      debounceMs: 60_000,
      backoffStartMs: 0,
      onWaiting: () => waiting.push(true),
    });
    try {
      await waitFor(() => orcha.lifecycles.length === 1, "lifecycle");
      const lost = readLines("events-lost.ndjson").find((line) => line.error?.code === "events_lost");
      if (!lost) throw new Error("fixture missing events_lost");
      orcha.lifecycles[0]?.deliver(lost);
      await waitFor(
        () => orcha.lifecycles.length >= 2 && link.state().orcha.connected,
        "resubscribe",
      );
      expect(waiting.length).toBeGreaterThan(0);
    } finally {
      link.stop();
    }
  });

  test("a rejected status subscription refreshes and retries", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    orcha.rejectStatus = 1;
    const office = tempOffice();
    const link = startLink({
      connect: orcha.connect,
      socketPath: "mock",
      local: office.local,
      activity: office.activity,
      debounceMs: 60_000,
      backoffStartMs: 0,
    });
    try {
      await waitFor(
        () => orcha.statusSubs.length === 1 && link.state().orcha.connected,
        "retried status subscription",
      );
      expect(orcha.snapshots).toBeGreaterThanOrEqual(2);
      expect(link.state().agents).toHaveLength(1);
    } finally {
      link.stop();
    }
  });

  test("a quiet socket still gets a snapshot", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    const office = tempOffice();
    const link = startLink({
      connect: orcha.connect,
      socketPath: "mock",
      local: office.local,
      activity: office.activity,
      debounceMs: 0,
      backoffStartMs: 0,
      watchdogMs: 40,
    });
    try {
      await waitFor(() => orcha.snapshots >= 1, "first snapshot");
      const seen = orcha.snapshots;
      await waitFor(() => orcha.snapshots > seen, "watchdog snapshot");
    } finally {
      link.stop();
    }
  });

  test("a failed connect re-resolves the socket and state shows the path that worked", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    const office = tempOffice();
    let orchaUp = false;
    const calls: string[] = [];
    const resolve = () => {
      const path = orchaUp ? "/home/me/.config/orcha/herdr.sock" : "/home/me/.config/herdr/herdr.sock";
      calls.push(path);
      return path;
    };
    const link = startLink({
      connect: async () => {
        const path = resolve();
        if (path.endsWith("/herdr/herdr.sock")) {
          orchaUp = true;
          throw new Error("connect ECONNREFUSED");
        }
        return orcha.connect();
      },
      socketPath: resolve,
      local: office.local,
      activity: office.activity,
      debounceMs: 60_000,
      backoffStartMs: 0,
    });
    try {
      await waitFor(() => link.state().orcha.connected, "connected on the new socket");
      expect(link.state().orcha.socketPath).toBe("/home/me/.config/orcha/herdr.sock");
      const failed = calls.indexOf("/home/me/.config/herdr/herdr.sock");
      const picked = calls.lastIndexOf("/home/me/.config/orcha/herdr.sock");
      expect(failed).toBeGreaterThanOrEqual(0);
      expect(picked).toBeGreaterThan(failed);
    } finally {
      link.stop();
    }
  });

  test("status events patch the agent and take no extra snapshot", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-status-"));
    const fake = await startFakeOrcha({
      socketPath: path.join(dir, "herdr.sock"),
      snapshot: tinySnapshot(),
    });
    const office = tempOffice();
    const link = startLink({
      connect: () => connect(fake.socketPath),
      socketPath: fake.socketPath,
      local: office.local,
      activity: office.activity,
      debounceMs: 0,
      backoffStartMs: 0,
    });
    const snapshots = () => fake.calls.filter((call) => call.method === "session.snapshot").length;
    try {
      await waitFor(() => link.state().orcha.connected, "connected");
      const before = snapshots();
      expect(before).toBeGreaterThan(0);
      for (let i = 0; i < 4; i += 1) fake.pushStatus("w1:p1", i % 2 === 0 ? "working" : "idle");
      fake.pushStatus("w1:p1", "blocked");
      await waitFor(() => link.state().agents[0]?.status === "blocked", "patched status");
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(snapshots()).toBe(before);
    } finally {
      link.stop();
      await fake.close();
    }
  });

  test("dropping the socket starts a new subscription", async () => {
    const orcha = new MockOrcha(tinySnapshot());
    const office = tempOffice();
    const link = startLink({
      connect: orcha.connect,
      socketPath: "mock",
      local: office.local,
      activity: office.activity,
      debounceMs: 0,
      backoffStartMs: 0,
    });
    try {
      await waitFor(() => orcha.lifecycles.length === 1, "first subscription");
      link.dropSocket();
      await waitFor(() => orcha.lifecycles.length >= 2, "reconnected");
    } finally {
      link.stop();
    }
  });
});

describe("local state and activity", () => {
  test("writes state atomically and keeps floor memory", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "orcha-office-"));
    const file = path.join(home, "state.json");
    const local = loadLocal(file);
    local.update((draft) => {
      draft.seen["w2:p1"] = 217;
      draft.skins["w2:p1"] = "headset";
      draft.floor.seats["w2:p1"] = { projectId: "w2", benchIndex: 1, seat: 2 };
    });
    const again = loadLocal(file);
    expect(again.get().seen["w2:p1"]).toBe(217);
    expect(again.get().skins["w2:p1"]).toBe("headset");
    expect(again.get().floor.seats["w2:p1"]).toEqual({ projectId: "w2", benchIndex: 1, seat: 2 });
    expect("benches" in again.get().floor).toBe(false);
    expect(fs.readdirSync(home).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  test("activity drops entries older than 7 days and truncates actions", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "orcha-office-"));
    const file = path.join(home, "activity.jsonl");
    const now = 1_700_000_000_000;
    writeAtomic(path.join(home, "unused.json"), emptyLocal());
    fs.writeFileSync(
      file,
      `${JSON.stringify({ id: "old", at: now - 8 * 24 * 60 * 60 * 1000, kind: "status", text: "old" })}\n` +
        `${JSON.stringify({ id: "new", at: now - 1000, kind: "status", text: "new" })}\n`,
    );
    const log = openActivity(file, now);
    expect(log.entries().map((entry) => entry.id)).toEqual(["new"]);
    const action = log.append({ kind: "action", text: "x".repeat(400), paneId: "w1:p1" });
    expect(action.text).toHaveLength(200);
    expect(log.recent(10)[0]?.text).toHaveLength(200);
  });
});
