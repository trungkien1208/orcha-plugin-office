import { NO_ACCOUNT_API, planSwitch, type AccountInfo, type Agent, type SwitchPlan } from "@easy-job/shared";
import fs from "node:fs";
import path from "node:path";
import { listAccounts, type AccountRoots } from "./accounts.ts";
import { ActionError } from "./actions.ts";
import { claudeSlug } from "./conversation/load.ts";
import type { OfficeLink } from "./orcha/link.ts";
import type { ActivityLog } from "./state/activity.ts";

const waiting = new Map<string, { accountId: string; moveAll?: boolean }>();

export function resumeLine(kind: string, session: string | undefined, dir?: string): string {
  if (kind === "codex") return "codex resume --last --no-daemon";
  if (kind === "cursor") return "cursor-agent resume";
  const command = session ? `claude --resume ${session}` : "claude";
  if (!dir) return command;
  return `CLAUDE_CONFIG_DIR=${quote(dir)} ${command}`;
}

function quote(value: string): string {
  return /^[\w./~:-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Where a Claude session file lives for a config folder. */
export function sessionPath(dir: string, cwd: string, session: string): string {
  return path.join(dir, "projects", claudeSlug(cwd), `${session}.jsonl`);
}

/**
 * The session file is in the new folder, or can be linked from the old one.
 * A link is a symlink. The source file stays where it is.
 */
export function linkSession(input: { from?: string; to: string }): { linked: boolean; created: boolean } {
  if (fs.existsSync(input.to)) return { linked: true, created: false };
  if (!input.from || !fs.existsSync(input.from)) return { linked: false, created: false };
  fs.mkdirSync(path.dirname(input.to), { recursive: true });
  fs.symlinkSync(input.from, input.to);
  return { linked: true, created: true };
}

export function describeSwitch(input: {
  agent: Agent;
  accountId: string;
  mode: "keychain" | "restart" | "handoff";
  accounts: AccountInfo[];
  home: string;
  handoff?: boolean;
}): SwitchPlan {
  const target = input.accounts.find((account) => account.id === input.accountId);
  if (!target) throw new ActionError(404, "No such account");
  if (input.mode === "keychain") {
    return planSwitch({ mode: "keychain", alsoMoves: alsoMoves(input.accounts, input.agent, target) });
  }
  if (input.mode === "handoff") return planSwitch({ mode: "handoff", handoff: input.handoff === true });
  const session = input.agent.session?.value;
  const cwd = input.agent.cwd;
  const dest = target.dir ?? path.join(input.home, ".claude");
  const linked = Boolean(session && cwd && (fs.existsSync(sessionPath(dest, cwd, session)) || fs.existsSync(sessionPath(path.join(input.home, ".claude"), cwd, session))));
  return planSwitch({ mode: "restart", needsIdle: input.agent.status === "working", sessionLinked: linked });
}

function alsoMoves(accounts: AccountInfo[], agent: Agent, target: AccountInfo): string[] {
  const folder = target.dir ?? "";
  return accounts
    .filter((account) => (account.dir ?? "") === folder && account.kind === target.kind)
    .flatMap((account) => account.panes)
    .filter((paneId) => paneId !== agent.paneId);
}

export async function switchAccount(input: {
  link: OfficeLink;
  agent: Agent;
  accountId: string;
  mode: "keychain" | "restart" | "handoff";
  whenIdle?: boolean;
  roots: AccountRoots;
  activity: ActivityLog;
  waitMs?: number;
  handoff?: (agent: Agent, accountId: string) => Promise<{ paneId: string }>;
}): Promise<{ ok: true; paneId: string }> {
  if (input.mode === "keychain") throw new ActionError(501, NO_ACCOUNT_API);
  if (input.mode === "handoff") {
    if (!input.handoff) throw new ActionError(501, "Not ready");
    return { ok: true, ...(await input.handoff(input.agent, input.accountId)) };
  }
  if (input.agent.status === "working" && !input.whenIdle) throw new ActionError(409, "Agent is busy");
  if (input.agent.status !== "idle") {
    waiting.set(input.agent.paneId, { accountId: input.accountId });
    return { ok: true, paneId: input.agent.paneId };
  }
  await restart(input);
  return { ok: true, paneId: input.agent.paneId };
}

export async function flushSwitches(input: {
  link: OfficeLink;
  agents: Agent[];
  roots: AccountRoots;
  activity: ActivityLog;
  waitMs?: number;
}) {
  if (waiting.size === 0) return;
  for (const agent of input.agents) {
    if (agent.status !== "idle") continue;
    const job = waiting.get(agent.paneId);
    if (!job) continue;
    waiting.delete(agent.paneId);
    await restart({ ...input, agent, accountId: job.accountId });
  }
}

async function restart(input: {
  link: OfficeLink;
  agent: Agent;
  accountId: string;
  roots: AccountRoots;
  activity: ActivityLog;
  waitMs?: number;
}) {
  const accounts = listAccounts({ roots: input.roots, installed: {} });
  const target = accounts.find((account) => account.id === input.accountId);
  if (!target) throw new ActionError(404, "No such account");
  const session = input.agent.session?.value;
  const cwd = input.agent.cwd;
  if (target.kind === "claude" && session && cwd) {
    const dest = target.dir ?? path.join(input.roots.home, ".claude");
    linkSession({ from: findSource(input.roots.home, cwd, session), to: sessionPath(dest, cwd, session) });
  }
  await input.link.request("agent.send_keys", { target: input.agent.paneId, keys: ["ctrl-c", "ctrl-c"] });
  await Bun.sleep(input.waitMs ?? 400);
  const line = resumeLine(target.kind, session, target.kind === "claude" ? target.dir : undefined);
  await input.link.request("pane.send_input", { pane_id: input.agent.paneId, text: line, keys: ["enter"] });
  input.activity.append({ kind: "action", text: `Switch ${input.agent.name} to ${target.label}`, paneId: input.agent.paneId, agentKey: input.agent.agentKey, workspaceId: input.agent.workspaceId });
}

function findSource(home: string, cwd: string, session: string): string | undefined {
  const file = sessionPath(path.join(home, ".claude"), cwd, session);
  return fs.existsSync(file) ? file : undefined;
}
