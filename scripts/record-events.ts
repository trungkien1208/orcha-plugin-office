/**
 * Record raw Orcha socket lines for fixtures.
 * Usage: bun scripts/record-events.ts
 * Does not start or prompt any Agent. It opens a scratch Project (no focus),
 * records lifecycle lines, closes that Project, and captures a rejected
 * subscription plus an events_lost line when the server emits one.
 */
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const outDir = path.join(root, "packages/bridge/test/fixtures");
const sock =
  process.env.ORCHA_OFFICE_SOCKET ??
  process.env.HERDR_SOCKET_PATH ??
  path.join(os.homedir(), ".config/orcha/herdr.sock");

const LIFECYCLE = [
  "workspace.created",
  "workspace.updated",
  "workspace.metadata_updated",
  "workspace.renamed",
  "workspace.moved",
  "workspace.reordered",
  "workspace.closed",
  "workspace.focused",
  "tab.created",
  "tab.closed",
  "tab.focused",
  "tab.renamed",
  "tab.moved",
  "pane.created",
  "pane.closed",
  "pane.updated",
  "pane.focused",
  "pane.moved",
  "pane.exited",
  "pane.agent_detected",
  "layout.updated",
];

type OrchaResponse = {
  id: string;
  result?: {
    workspace?: { workspace_id?: string };
    tab?: { tab_id?: string };
    snapshot?: { panes?: Array<{ pane_id: string }> };
  };
  error?: { code: string; message: string };
};

class Conn {
  buf = "";
  queue: string[] = [];
  waiters: Array<(line: string | null) => void> = [];
  closed = false;
  constructor(private socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buf += chunk;
      for (;;) {
        const i = this.buf.indexOf("\n");
        if (i < 0) break;
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 1);
        const waiter = this.waiters.shift();
        if (waiter) waiter(line);
        else this.queue.push(line);
      }
    });
    socket.on("close", () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) waiter(null);
    });
    socket.on("error", () => {
      this.closed = true;
    });
  }
  send(obj: unknown) {
    this.socket.write(`${JSON.stringify(obj)}\n`);
  }
  next(timeoutMs: number): Promise<string | null> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(onLine);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve(null);
      }, timeoutMs);
      const onLine = (line: string | null) => {
        clearTimeout(timer);
        resolve(line);
      };
      this.waiters.push(onLine);
    });
  }
  end() {
    this.socket.end();
  }
  destroy() {
    this.socket.destroy();
  }
}

function connect(): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(sock);
    socket.once("connect", () => resolve(new Conn(socket)));
    socket.once("error", reject);
  });
}

let seq = 0;
async function call(method: string, params: unknown, timeoutMs = 8000) {
  const conn = await connect();
  const id = `rec-${++seq}`;
  conn.send({ id, method, params });
  const line = await conn.next(timeoutMs);
  conn.end();
  if (!line) throw new Error(`no response for ${method}`);
  return JSON.parse(line) as OrchaResponse;
}

async function recordRejected() {
  const conn = await connect();
  const id = "rej-1";
  conn.send({
    id,
    method: "events.subscribe",
    params: {
      subscriptions: [{ type: "pane.agent_status_changed", pane_id: "w0:missing" }],
    },
  });
  const lines: string[] = [];
  for (;;) {
    const line = await conn.next(3000);
    if (line == null) break;
    lines.push(line);
  }
  const file = path.join(outDir, "events-rejected.ndjson");
  fs.writeFileSync(file, lines.join("\n") + (lines.length ? "\n" : ""));
  console.log("rejected", lines.length, "lines, closed", conn.closed);
  return lines;
}

async function recordLost() {
  const created = await call("workspace.create", {
    cwd: root,
    focus: false,
    label: "oo-scratch-lost",
  });
  const workspaceId = created.result?.workspace?.workspace_id as string | undefined;
  if (!workspaceId) {
    console.log("events_lost skipped, create failed", JSON.stringify(created));
    return;
  }
  const conn = await connect();
  conn.send({
    id: "lost-sub",
    method: "events.subscribe",
    params: { subscriptions: [{ type: "workspace.renamed" }] },
  });
  const ack = await conn.next(4000);
  const lines: string[] = [];
  if (ack) lines.push(ack);
  // One request per connection. Burst past the 512-event history window between polls.
  let next = 0;
  const total = 700;
  await Promise.all(
    Array.from({ length: 70 }, async () => {
      while (next < total) {
        const i = next++;
        try {
          const one = await connect();
          one.send({
            id: `rn-${i}`,
            method: "workspace.rename",
            params: { workspace_id: workspaceId, label: `oo-${i}` },
          });
          await one.next(2000);
          one.end();
        } catch {
          /* a rejected rename still counts if the server emitted the event */
        }
      }
    }),
  );
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const line = await conn.next(400);
    if (line == null) break;
    lines.push(line);
    if (line.includes("events_lost")) break;
    if (lines.length > 40) break;
  }
  conn.destroy();
  await call("workspace.close", { workspace_id: workspaceId }).catch((err) => {
    console.log("close scratch failed", err);
  });
  const file = path.join(outDir, "events-lost.ndjson");
  fs.writeFileSync(file, `${lines.filter(Boolean).join("\n")}\n`);
  const lost = lines.find((line) => line.includes("events_lost"));
  console.log("events_lost captured", Boolean(lost), "lines", lines.length);
  if (lost) console.log(lost.slice(0, 300));
}

async function recordLive() {
  const snap = await call("session.snapshot", {});
  const panes: Array<{ pane_id: string }> = snap.result?.snapshot?.panes ?? [];
  const conn = await connect();
  const subscriptions = [
    ...LIFECYCLE.map((type) => ({ type })),
    ...panes.map((pane) => ({ type: "pane.agent_status_changed", pane_id: pane.pane_id })),
  ];
  conn.send({ id: "live-sub", method: "events.subscribe", params: { subscriptions } });
  const lines: string[] = [];
  const ack = await conn.next(8000);
  if (ack) lines.push(ack);

  const created = await call("workspace.create", {
    cwd: root,
    focus: false,
    label: "oo-scratch",
  });
  const workspaceId = created.result?.workspace?.workspace_id as string | undefined;
  console.log("scratch workspace", workspaceId, created.error ?? "ok");
  if (workspaceId) {
    const tab = await call("tab.create", { workspace_id: workspaceId, cwd: root, focus: false });
    console.log("scratch tab", tab.result?.tab?.tab_id ?? tab.error);
    await call("workspace.close", { workspace_id: workspaceId });
    console.log("scratch closed");
  }

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && lines.length < 250) {
    const line = await conn.next(500);
    if (line == null) break;
    lines.push(line);
  }
  conn.destroy();
  const file = path.join(outDir, "events-live.ndjson");
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  const kinds = new Map<string, number>();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const kind = obj.event ?? obj.result?.type ?? obj.error?.code ?? "other";
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    } catch {
      kinds.set("unparsed", (kinds.get("unparsed") ?? 0) + 1);
    }
  }
  console.log("live lines", lines.length);
  for (const [k, n] of [...kinds.entries()].sort()) console.log(" ", n, k);
}

fs.mkdirSync(outDir, { recursive: true });
console.log("socket", sock);
await recordRejected();
await recordLive();
await recordLost();
console.log("done");
