import type { SessionSnapshot } from "@easy-job/shared";
import fs from "node:fs";
import net from "node:net";

export type FakeCall = { method: string; params: unknown };

export type FakeOrcha = {
  socketPath: string;
  calls: FakeCall[];
  snapshot: SessionSnapshot;
  /** Push a status event to the status subscription only. Does not change the snapshot. */
  pushStatus(paneId: string, agentStatus: string): void;
  close(): Promise<void>;
};

type RequestLine = { id?: string; method?: string; params?: Record<string, unknown> };

export function startFakeOrcha(input: { socketPath: string; snapshot: SessionSnapshot; pingProtocol?: number }): Promise<FakeOrcha> {
  const calls: FakeCall[] = [];
  const snapshot = structuredClone(input.snapshot);
  const subscribers = new Set<net.Socket>();
  const statusSockets = new Set<net.Socket>();
  // Closing a pane or workspace really removes it, then tells subscribers, like Orcha does.
  const notify = (event: string) => { for (const socket of subscribers) write(socket, { event, data: {} }); };
  if (fs.existsSync(input.socketPath)) fs.unlinkSync(input.socketPath);
  const server = net.createServer((socket) => {
    let buf = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buf += chunk;
      const end = buf.indexOf("\n");
      if (end < 0) return;
      const raw = buf.slice(0, end);
      buf = buf.slice(end + 1);
      let request: RequestLine;
      try {
        request = JSON.parse(raw) as RequestLine;
      } catch {
        return;
      }
      const method = request.method ?? "";
      const params = request.params ?? {};
      if (method !== "events.subscribe") calls.push({ method, params });
      write(socket, reply(request.id ?? "", method, params, snapshot, input.pingProtocol));
      if (method === "events.subscribe") {
        const subs = Array.isArray(params.subscriptions) ? (params.subscriptions as Array<{ type?: string }>) : [];
        const bucket = subs.some((item) => item.type === "pane.agent_status_changed") ? statusSockets : subscribers;
        bucket.add(socket);
        socket.on("close", () => {
          subscribers.delete(socket);
          statusSockets.delete(socket);
        });
        return;
      }
      if (method === "pane.close" || method === "workspace.close" || method === "workspace.create") notify(method === "pane.close" ? "pane.closed" : method === "workspace.create" ? "workspace.created" : "workspace.closed");
      if (method === "tab.create") notify("pane.created");
      if (method === "agent.start") notify("pane.agent_detected");
      if (method === "agent.rename") notify("pane.updated");
      socket.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.socketPath, () => {
      resolve({
        socketPath: input.socketPath,
        calls,
        snapshot,
        pushStatus(paneId, agentStatus) {
          const line = { event: "pane.agent_status_changed", data: { pane_id: paneId, agent_status: agentStatus } };
          for (const socket of statusSockets) write(socket, line);
        },
        close: () =>
          new Promise((done) => {
            server.close(() => {
              if (fs.existsSync(input.socketPath)) fs.unlinkSync(input.socketPath);
              done();
            });
          }),
      });
    });
  });
}

function write(socket: net.Socket, body: unknown) {
  socket.write(`${JSON.stringify(body)}\n`);
}

function reply(id: string, method: string, params: Record<string, unknown>, snapshot: SessionSnapshot, pingProtocol?: number) {
  if (method === "session.snapshot") return { id, result: { type: "session_snapshot", snapshot } };
  if (method === "events.subscribe") return { id, result: { type: "subscription_started" } };
  if (method === "agent.read") {
    const text =
      params.source === "detection"
        ? "❯ 1. Yes\n2. Always allow\n3. No"
        : "placeholder terminal text";
    return { id, result: { type: "pane_read", read: { text, pane_id: params.target } } };
  }
  if (method === "tab.create") {
    const workspaceId = String(params.workspace_id ?? "");
    let n = 1;
    while (snapshot.panes.some((pane) => pane.pane_id === `${workspaceId}:p${n}`)) n += 1;
    const paneId = `${workspaceId}:p${n}`;
    const tabId = `${workspaceId}:t${n}`;
    snapshot.panes.push({
      pane_id: paneId,
      workspace_id: workspaceId,
      tab_id: tabId,
      cwd: String(params.cwd ?? ""),
      agent_status: "idle",
    } as SessionSnapshot["panes"][number]);
    return { id, result: { type: "tab_created", tab: { tab_id: tabId }, root_pane: { pane_id: paneId } } };
  }
  if (method === "server.agent_manifests") {
    return { id, result: { type: "agent_manifest_status", manifests: [{ agent: "claude" }, { agent: "codex" }] } };
  }
  if (method === "agent.start") {
    const paneId = String(params.pane_id ?? "");
    const pane = snapshot.panes.find((item) => item.pane_id === paneId);
    const kind = String(params.kind ?? "claude");
    const name = String(params.name ?? "").trim();
    const session = `sess-${paneId}`;
    if (pane) pane.agent_status = "idle";
    snapshot.agents = snapshot.agents.filter((agent) => agent.pane_id !== paneId);
    snapshot.agents.push({
      pane_id: paneId,
      workspace_id: pane?.workspace_id ?? "",
      tab_id: pane?.tab_id ?? "",
      name: name || undefined,
      agent: kind,
      agent_status: "idle",
      cwd: pane?.cwd,
      agent_session: { source: kind, agent: kind, kind: "id", value: session },
      interactive_ready: true,
      state_change_seq: 1,
    } as SessionSnapshot["agents"][number]);
    return { id, result: { type: "ok" } };
  }
  if (method === "agent.rename") {
    const agent = snapshot.agents.find((item) => item.pane_id === String(params.target ?? ""));
    if (agent) {
      agent.name = String(params.name ?? "");
      agent.state_change_seq = (agent.state_change_seq ?? 0) + 1;
    }
    return { id, result: { type: "ok" } };
  }
  if (method === "ping") return { id, result: { type: "pong", version: snapshot.version ?? "0.9.5", protocol: pingProtocol ?? snapshot.protocol ?? 22 } };
  if (method === "workspace.create") {
    const number = Math.max(0, ...snapshot.workspaces.map((workspace) => workspace.number)) + 1;
    const workspaceId = `wN${number}`;
    snapshot.workspaces.push({ workspace_id: workspaceId, label: String(params.label ?? "New"), number, agent_status: "unknown", tab_count: 1, pane_count: 1, focused: false } as SessionSnapshot["workspaces"][number]);
    snapshot.panes.push({ pane_id: `${workspaceId}:p1`, workspace_id: workspaceId, tab_id: `${workspaceId}:t1`, cwd: String(params.cwd ?? "") } as SessionSnapshot["panes"][number]);
    return { id, result: { type: "workspace_info", workspace: { workspace_id: workspaceId } } };
  }
  if (method === "pane.close") {
    const paneId = String(params.pane_id ?? "");
    snapshot.panes = snapshot.panes.filter((pane) => pane.pane_id !== paneId);
    snapshot.agents = snapshot.agents.filter((agent) => agent.pane_id !== paneId);
    return { id, result: { type: "ok" } };
  }
  if (method === "workspace.close") {
    const workspaceId = String(params.workspace_id ?? "");
    snapshot.workspaces = snapshot.workspaces.filter((workspace) => workspace.workspace_id !== workspaceId);
    snapshot.panes = snapshot.panes.filter((pane) => pane.workspace_id !== workspaceId);
    snapshot.agents = snapshot.agents.filter((agent) => agent.workspace_id !== workspaceId);
    return { id, result: { type: "ok" } };
  }
  return { id, result: { type: "ok" } };
}

export function demoSnapshot(base: SessionSnapshot): SessionSnapshot {
  const snapshot = structuredClone(base);
  const agent = snapshot.agents.find((item) => item.pane_id === "w2:p1") ?? snapshot.agents[0];
  if (agent) {
    agent.agent_status = "blocked";
    agent.name = "Headset";
    agent.tokens = { ...(agent.tokens ?? {}), task: "Allow the tests?" };
  }
  return snapshot;
}
