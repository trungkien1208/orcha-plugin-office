#!/usr/bin/env bun
// `easy-job` command: start/open the office, stop it, check the machine, and hook it into Orcha.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatChecks, runDoctor } from "./doctor.ts";
import { pidAlive, readBridge, type BridgeRecord } from "./instance.ts";
import { serve } from "./main.ts";
import { createClient } from "./orcha/client.ts";
import { connect, resolveSocketPath } from "./orcha/transport.ts";
import { HOST_TOKEN, HOST_TOKEN_VALUE, HOST_WORKSPACE_LABEL, isHostWorkspace } from "./state/hide.ts";
import { commandFor, publicArtDir } from "./paths.ts";
import { defaultHome } from "./state/local.ts";

const REPO = path.resolve(import.meta.dir, "../../..");
const PLUGIN_DIR = path.join(REPO, "integrations", "orcha-plugin");
const LAUNCH_LABEL = "dev.easyjob.bridge";
const USAGE = `Usage: easy-job [command]

  (none)                 start the office if needed and open it in the browser
  serve [--no-open] [--port N] [--session NAME]
                         run the bridge in the foreground
  open [--via-orcha]     open the browser, starting the bridge in the background if needed
  stop                   stop the running bridge
  status                 show the running bridge and what it sees
  doctor                 check Orcha, transcripts, data folder and art, with fixes
  autostart on|off       start the bridge at login (macOS LaunchAgent)
  orcha-plugin install|uninstall
                         add "Open Easy Job" to Orcha's command palette
`;

const home = defaultHome();

function running(): BridgeRecord | null {
  const record = readBridge(home);
  return record && pidAlive(record.pid) ? record : null;
}

function urlOf(record: BridgeRecord): string {
  return `http://127.0.0.1:${record.port}/#t=${record.token}`;
}

function openBrowser(url: string) {
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

async function waitForBridge(ms = 10_000): Promise<BridgeRecord | null> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const record = running();
    if (record) return record;
    await Bun.sleep(200);
  }
  return null;
}

function selfCommand(): string[] {
  return commandFor(process.execPath, Bun.which("bun"), import.meta.path);
}

function startInBackground() {
  const logs = path.join(home, "logs");
  fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
  const out = fs.openSync(path.join(logs, "bridge.out"), "a");
  const [bin = "bun", ...args] = selfCommand();
  spawn(bin, [...args, "serve", "--no-open"], { stdio: ["ignore", out, out], detached: true }).unref();
}

/** Inside Orcha: host the bridge in an Orcha-managed tab of a hidden host workspace, without moving focus. */
async function startViaOrcha(): Promise<void> {
  type Snap = { snapshot: { workspaces: { workspace_id: string; label: string; tokens?: Record<string, string> }[]; panes: { pane_id: string; workspace_id: string }[] } };
  const client = createClient(() => connect(resolveSocketPath()));
  let snap = (await client.request("session.snapshot")) as Snap;
  let host = snap.snapshot.workspaces.find(isHostWorkspace);
  if (!host) {
    const created = (await client.request("workspace.create", { label: HOST_WORKSPACE_LABEL, focus: false })) as { workspace?: { workspace_id?: string } };
    snap = (await client.request("session.snapshot")) as Snap;
    const id = created.workspace?.workspace_id;
    host = snap.snapshot.workspaces.find((item) => item.workspace_id === id) ?? snap.snapshot.workspaces.filter((item) => item.label.trim() === HOST_WORKSPACE_LABEL).at(-1);
    if (!host) throw new Error("Orcha did not create the Easy Job bridge workspace");
    await markHost(client, host.workspace_id);
  }
  const target = snap.snapshot.panes.find((pane) => pane.workspace_id === host?.workspace_id);
  await client.request("plugin.pane.open", { plugin_id: "easy-job", entrypoint: "server", placement: "tab", target_pane_id: target?.pane_id ?? null, focus: false });
}

/** Tag the host workspace so the Floor hides it (tokens are not restored after an Orcha restart; serve re-tags it). */
export async function markHost(client: ReturnType<typeof createClient>, workspaceId: string) {
  await client.request("workspace.report_metadata", { workspace_id: workspaceId, source: "easy-job", tokens: { [HOST_TOKEN]: HOST_TOKEN_VALUE } });
}

async function open(args: string[]) {
  let record = running();
  if (!record) {
    if (args.includes("--via-orcha")) await startViaOrcha();
    else startInBackground();
    record = await waitForBridge();
  }
  if (!record) {
    process.stderr.write(`Easy Job did not start. See ${path.join(home, "logs", "bridge.out")} or run \`easy-job doctor\`.\n`);
    process.exit(1);
  }
  const url = urlOf(record);
  process.stdout.write(`${url}\n`);
  openBrowser(url);
}

async function stop() {
  const record = running();
  if (!record) {
    process.stdout.write("Easy Job is not running.\n");
    return;
  }
  process.kill(record.pid, "SIGTERM");
  const until = Date.now() + 3000;
  while (pidAlive(record.pid) && Date.now() < until) await Bun.sleep(100);
  process.stdout.write(pidAlive(record.pid) ? `Bridge ${record.pid} did not stop.\n` : "Stopped Easy Job.\n");
}

async function status() {
  const record = running();
  if (!record) {
    process.stdout.write("Easy Job is not running. Start it with `easy-job`.\n");
    return;
  }
  try {
    const response = await fetch(`http://127.0.0.1:${record.port}/api/state`, { headers: { Authorization: `Bearer ${record.token}` } });
    const state = (await response.json()) as { orcha: { connected: boolean; socketPath: string; protocol?: number }; counts: { needsMe: number; done: number; working: number; projects: number }; agents: unknown[] };
    const lines = [
        `Easy Job running · pid ${record.pid} · ${urlOf(record)}`,
        `Orcha ${state.orcha.connected ? "connected" : "not running"} · ${state.orcha.socketPath}${state.orcha.protocol ? ` · protocol ${state.orcha.protocol}` : ""}`,
        `${state.counts.projects} Projects · ${state.agents.length} Agents · needs you ${state.counts.needsMe} · done ${state.counts.done} · working ${state.counts.working}`,
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
  } catch (error) {
    process.stdout.write(`Easy Job pid ${record.pid} is up but did not answer: ${(error as Error).message}\n`);
  }
}

async function doctor() {
  const checks = await runDoctor({ socketPath: resolveSocketPath(), home, publicDir: publicArtDir(process.execPath, import.meta.dir) });
  process.stdout.write(`${formatChecks(checks)}\n`);
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
}

export function launchAgentPlist(command: string[], logFile: string): string {
  const args = command.map((arg) => `    <string>${arg.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCH_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${logFile}</string>
  <key>StandardErrorPath</key><string>${logFile}</string>
</dict>
</plist>
`;
}

function autostart(mode: string | undefined) {
  if (process.platform !== "darwin") {
    process.stderr.write("autostart is macOS only for now.\n");
    process.exit(2);
  }
  const plist = path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCH_LABEL}.plist`);
  const domain = `gui/${process.getuid?.() ?? 501}`;
  if (mode === "on") {
    fs.mkdirSync(path.dirname(plist), { recursive: true });
    fs.mkdirSync(path.join(home, "logs"), { recursive: true, mode: 0o700 });
    fs.writeFileSync(plist, launchAgentPlist([...selfCommand(), "serve", "--no-open"], path.join(home, "logs", "launchd.log")));
    spawnSync("launchctl", ["bootout", `${domain}/${LAUNCH_LABEL}`], { stdio: "ignore" });
    const result = spawnSync("launchctl", ["bootstrap", domain, plist], { encoding: "utf8" });
    process.stdout.write(result.status === 0 ? "Easy Job now starts at login.\n" : `launchctl: ${result.stderr.trim()}\n`);
  } else if (mode === "off") {
    spawnSync("launchctl", ["bootout", `${domain}/${LAUNCH_LABEL}`], { stdio: "ignore" });
    fs.rmSync(plist, { force: true });
    process.stdout.write("Easy Job no longer starts at login.\n");
  } else {
    process.stderr.write("Usage: easy-job autostart on|off\n");
    process.exit(2);
  }
}

function orchaPlugin(mode: string | undefined) {
  if (mode === "install") {
    const result = spawnSync("orcha", ["plugin", "link", PLUGIN_DIR], { encoding: "utf8" });
    if (result.status !== 0) {
      process.stderr.write(`orcha plugin link failed: ${(result.stderr || result.stdout).trim()}\n`);
      process.exit(1);
    }
    process.stdout.write(`Linked ${PLUGIN_DIR}.
"Open Easy Job" is in Orcha's command palette. To bind a key, add this to your Orcha config:

[[keys.command]]
key = "prefix+j"
type = "plugin_action"
command = "easy-job.open"
description = "open Easy Job"
`);
  } else if (mode === "uninstall") {
    const result = spawnSync("orcha", ["plugin", "unlink", "easy-job"], { encoding: "utf8" });
    process.stdout.write(result.status === 0 ? "Unlinked the Easy Job plugin.\n" : `${(result.stderr || result.stdout).trim()}\n`);
  } else {
    process.stderr.write("Usage: easy-job orcha-plugin install|uninstall\n");
    process.exit(2);
  }
}

export async function main(argv: string[]) {
  const [command = "", ...rest] = argv;
  if (command === "" || command.startsWith("-")) {
    if (command === "--help" || command === "-h") return void process.stdout.write(USAGE);
    return serve(argv);
  }
  if (command === "serve") return serve(rest);
  if (command === "open") return open(rest);
  if (command === "stop") return stop();
  if (command === "status") return status();
  if (command === "doctor") return doctor();
  if (command === "autostart") return autostart(rest[0]);
  if (command === "orcha-plugin") return orchaPlugin(rest[0]);
  if (command === "help") return void process.stdout.write(USAGE);
  process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
  process.exit(2);
}

if (import.meta.main) await main(process.argv.slice(2));
