import { startServer } from "./http/server.ts";
import { claimBridge, pidAlive, readBridge, readToken, releaseBridge, saveToken } from "./instance.ts";
import { createClient } from "./orcha/client.ts";
import { startLink, type OfficeLink } from "./orcha/link.ts";
import { HOST_TOKEN, HOST_TOKEN_VALUE } from "./state/hide.ts";
import { connect, resolveSocketPath, type SocketOptions } from "./orcha/transport.ts";
import { manifestPath } from "./state/catalog.ts";
import { activityFile, openActivity } from "./state/activity.ts";
import { defaultHome, loadLocal } from "./state/local.ts";
import { pruneUploads } from "./uploads.ts";
import { statusLabel } from "./state/reconcile.ts";
import type { Agent, OfficeState } from "@easy-job/shared";
import path from "node:path";
import { parseArgs as parseCli } from "node:util";
import { webDistDir } from "./paths.ts";

const OPTIONS = {
  print: { type: "boolean" },
  dev: { type: "boolean" },
  "no-open": { type: "boolean" },
  "new-token": { type: "boolean" },
  session: { type: "string" },
  socket: { type: "string" },
  port: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

type Flags = SocketOptions & { print: boolean; port: number; dev: boolean; open: boolean; newToken: boolean };

function parseArgs(argv: string[]): Flags {
  let values: ReturnType<typeof parseCli<{ options: typeof OPTIONS; strict: true }>>["values"];
  try {
    ({ values } = parseCli({ args: argv, options: OPTIONS, strict: true }));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
  if (values.help) {
    process.stdout.write("Usage: easy-job serve [--port 4317] [--session name] [--no-open] [--new-token]\n");
    process.stdout.write("       bun run bridge -- --print\n");
    process.exit(0);
  }
  return {
    print: values.print ?? false,
    port: Number(values.port ?? 4317),
    dev: values.dev ?? false,
    open: !values["no-open"],
    newToken: values["new-token"] ?? false,
    session: values.session,
    socket: values.socket,
  };
}

function clock(at = new Date()): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value.padEnd(width, " ");
}

export function formatTable(state: OfficeState): string {
  const lines = [
    `Easy Job · ${state.counts.projects} Projects · ${state.agents.length} Agents · needs you ${state.counts.needsMe} · done ${state.counts.done} · working ${state.counts.working}`,
    "",
  ];
  const byProject = new Map<string, Agent[]>();
  for (const agent of state.agents) {
    const list = byProject.get(agent.workspaceId) ?? [];
    list.push(agent);
    byProject.set(agent.workspaceId, list);
  }
  for (const project of state.projects) {
    const agents = byProject.get(project.workspaceId) ?? [];
    if (agents.length === 0) {
      lines.push(`${pad(project.label, 28)} ${project.terminalCount} Terminals`);
      continue;
    }
    agents.forEach((agent, index) => {
      const label = index === 0 ? project.label : "";
      lines.push(
        `${pad(label, 28)} ${pad(agent.name, 16)} ${pad(statusLabel(agent.status), 12)} ${agent.task ?? ""}`.trimEnd(),
      );
    });
  }
  return lines.join("\n");
}

export function startPrintedLink(flags: Flags = { print: true, port: 4317, dev: false, open: true, newToken: false }): {
  link: OfficeLink;
  activity: ReturnType<typeof openActivity>;
} {
  const home = defaultHome();
  const local = loadLocal(`${home}/state.json`);
  const activity = openActivity(activityFile(home));
  let shown = false;
  // Resolved on every connect. The office state shows this path, not the one captured at startup.
  let socketPath = resolveSocketPath(flags);
  const link = startLink({
    connect: () => {
      socketPath = resolveSocketPath(flags);
      return connect(socketPath);
    },
    socketPath: () => socketPath,
    local,
    activity,
    manifestPath: manifestPath(import.meta.dir),
    hidePaneId: process.env.HERDR_PLUGIN_ID === "easy-job" ? process.env.HERDR_PANE_ID : undefined,
    onWaiting() {
      shown = false;
      process.stdout.write("Orcha isn't running, waiting…\n");
    },
    onState(state) {
      if (!flags.print || !state.orcha.connected || shown) return;
      shown = true;
      process.stdout.write(`${formatTable(state)}\n`);
    },
    onStatus(text) {
      if (!flags.print) return;
      process.stdout.write(`${clock()} ${text}\n`);
    },
  });
  return { link, activity };
}

const isMain = import.meta.main;
function reuseRunning(flags: Flags, home: string): boolean {
  if (flags.print || flags.newToken) return false;
  const existing = readBridge(home);
  if (!existing || !pidAlive(existing.pid)) return false;
  const url = `http://127.0.0.1:${existing.port}/#t=${existing.token}`;
  process.stdout.write(`${url}\n`);
  if (flags.open && !flags.dev) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
  return true;
}

/** `easy-job serve`: run the bridge in the foreground (reuses a live one unless --print/--new-token). */
export function serve(argv: string[]) {
  const flags = parseArgs(argv);
  const home = defaultHome();
  if (reuseRunning(flags, home)) process.exit(0);
  if (!flags.print) pruneUploads(home);
  const savedToken = flags.newToken ? undefined : (readToken(home) ?? readBridge(home)?.token);
  const office = startPrintedLink(flags);
  const link = office.link;
  // Running as the Orcha plugin pane: (re)tag our host workspace so the Floor hides it, even after an Orcha restart.
  if (process.env.HERDR_PLUGIN_ID === "easy-job" && process.env.HERDR_WORKSPACE_ID) {
    void createClient(() => connect(resolveSocketPath(flags)))
      .request("workspace.report_metadata", { workspace_id: process.env.HERDR_WORKSPACE_ID, source: "easy-job", tokens: { [HOST_TOKEN]: HOST_TOKEN_VALUE } })
      .catch(() => undefined);
  }
  let server: { stop(): void; port: number; token: string; bridgeId: string } | null = null;
  if (!flags.print) {
    const devOrigins = flags.dev ? ["http://127.0.0.1:5173", "http://localhost:5173"] : [];
    server = startServer({
      link,
      activity: office.activity,
      distDir: webDistDir(process.execPath, import.meta.dir),
      port: flags.port,
      open: flags.open && !flags.dev,
      extraOrigins: devOrigins,
      token: savedToken,
      bridgeId: crypto.randomUUID(),
      home,
    });
    if (server.port && server.token && server.bridgeId) {
      claimBridge(home, { pid: process.pid, port: server.port, token: server.token, bridgeId: server.bridgeId });
      saveToken(home, server.token);
    }
    if (flags.dev && server.port && server.token) {
      const url = `http://127.0.0.1:5173/#t=${server.token}`;
      Bun.spawn(["bun", "run", "--cwd", path.resolve(import.meta.dir, "../../web"), "dev"], {
        env: { ...process.env, EASY_JOB_PORT: String(server.port) },
        stdout: "inherit",
        stderr: "inherit",
      });
      if (flags.open) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
      process.stdout.write(`${url}\n`);
    }
  }
  const stop = () => {
    if (!flags.print) releaseBridge(home);
    server?.stop();
    link.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (isMain) serve(process.argv.slice(2));
