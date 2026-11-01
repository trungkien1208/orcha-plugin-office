/**
 * Manual smoke against a real Orcha. Not part of `bun run check` or CI.
 *
 * Requires `easy-job serve` (or `easy-job`) already running, Orcha up, and `claude` on PATH.
 * Run: bun scripts/smoke-live.ts
 *
 * Creates a scratch workspace in /tmp without moving focus, starts a Claude agent, sends one
 * short prompt, waits until it is idle, and reads the conversation through the bridge HTTP API.
 * The agent, the workspace, and the scratch folder are removed even when a step fails.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pidAlive, readBridge } from "../packages/bridge/src/instance.ts";
import { defaultHome } from "../packages/bridge/src/state/local.ts";

const label = `smoke-${process.pid}`;
const prompt = "Reply with the single word pong.";

type AgentRow = { paneId: string; status: string; kind?: string; interactiveReady?: boolean; launchPending?: boolean };
type State = { agents?: AgentRow[] };
type Page = { items?: unknown[]; terminal?: boolean };

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function step(name: string, result: string) {
  process.stdout.write(`${name}: ${result}\n`);
}

const record = readBridge(defaultHome());
if (!record || !pidAlive(record.pid)) {
  step("bridge", "not running. Start it with `easy-job serve` against a real Orcha, then run this again.");
  process.exit(1);
}

const base = `http://127.0.0.1:${record.port}`;
let dir = "";
let workspaceId = "";
let paneId = "";

async function api<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${record?.token}`, "content-type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body as T;
}

async function waitIdle(): Promise<string> {
  const start = Date.now();
  let sawBusy = false;
  let last = "missing";
  while (Date.now() - start < 90_000) {
    const state = await api<State>("/api/state");
    last = state.agents?.find((agent) => agent.paneId === paneId)?.status ?? "missing";
    if (last === "working" || last === "blocked") sawBusy = true;
    if ((last === "idle" || last === "done") && (sawBusy || Date.now() - start > 15_000)) return last;
    await Bun.sleep(1000);
  }
  throw new Error(`still ${last} after 90s`);
}

async function closeOut() {
  if (paneId) {
    try {
      await api(`/api/agents/${encodeURIComponent(paneId)}/close`, { method: "POST" });
      step("close agent", "ok");
    } catch (error) {
      step("close agent", detail(error));
      process.exitCode = 1;
    }
  }
  if (workspaceId) {
    try {
      await api(`/api/projects/${encodeURIComponent(workspaceId)}/close`, {
        method: "POST",
        body: JSON.stringify({ confirm: label }),
      });
      step("close workspace", "ok");
    } catch (error) {
      step("close workspace", detail(error));
      process.exitCode = 1;
    }
  }
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    step("scratch dir", "removed");
  }
}

try {
  step("bridge", base);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-smoke-"));
  const created = await api<{ workspaceId?: string }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ label, cwd: dir }),
  });
  workspaceId = created.workspaceId ?? "";
  if (!workspaceId) throw new Error("no workspace id");
  step("workspace", `${workspaceId} in ${dir} (focus false)`);
  const started = await api<{ paneId?: string }>(`/api/projects/${encodeURIComponent(workspaceId)}/agents`, {
    method: "POST",
    body: JSON.stringify({ kind: "claude", name: "smoke" }),
  });
  paneId = started.paneId ?? "";
  if (!paneId) throw new Error("no pane id");
  step("agent", paneId);
  const appeared = Date.now();
  let row: AgentRow | undefined;
  while (Date.now() - appeared < 20_000) {
    const state = await api<State>("/api/state");
    row = state.agents?.find((agent) => agent.paneId === paneId);
    if (row && !row.launchPending) break;
    await Bun.sleep(500);
  }
  if (!row || row.launchPending) throw new Error(`agent not ready (${row?.status ?? "missing"}, launchPending ${row?.launchPending ?? "?"})`);
  await api(`/api/agents/${encodeURIComponent(paneId)}/prompt`, {
    method: "POST",
    body: JSON.stringify({ text: prompt }),
  });
  step("prompt", "sent");
  step("idle", await waitIdle());
  const page = await api<Page>(`/api/agents/${encodeURIComponent(paneId)}/conversation`);
  step("conversation", `${page.items?.length ?? 0} items${page.terminal ? " (terminal text)" : ""}`);
} catch (error) {
  step("failed", detail(error));
  process.exitCode = 1;
} finally {
  await closeOut();
}
