import {
  fuelIsLow,
  type AccountInfo,
  type AccountKind,
  type Agent,
  type FuelWindowInfo,
} from "@easy-job/shared";
import { LRUCache } from "lru-cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OfficeLink } from "./orcha/link.ts";
import { orchaAccounts, supports } from "./orcha/v24.ts";

export type AccountRoots = { orchaDir: string; limitsDir: string; home: string };

export type PaneAccount = { paneId: string; kind: string; configDir?: string };

const KINDS = ["claude", "codex", "cursor"] as const;
const LABELS: Record<(typeof KINDS)[number], string> = { claude: "Claude", codex: "Codex", cursor: "Cursor" };

export function defaultAccountRoots(): AccountRoots {
  const home = os.homedir();
  return { home, orchaDir: path.join(home, ".config", "orcha"), limitsDir: path.join(home, ".cache", "orcha", "limits") };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function expand(dir: string, home: string): string {
  if (dir === "~") return home;
  if (dir.startsWith("~/")) return path.join(home, dir.slice(2));
  return dir;
}

/** Email and plan only. Anything else in the profile, including tokens, is dropped. */
function profileFields(value: unknown): { email?: string; plan?: string } {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const source = record.oauthAccount && typeof record.oauthAccount === "object" ? (record.oauthAccount as Record<string, unknown>) : record;
  return {
    email: text(source.emailAddress) ?? text(source.email),
    plan: text(source.plan) ?? text(source.subscriptionType),
  };
}

function limitsOf(file: string): FuelWindowInfo[] {
  const raw = readJson(file);
  return raw && typeof raw === "object" ? fuelWindows(raw as Record<string, unknown>) : [];
}

/** Orcha's limits cache `{window: [percentUsed, resetEpochSeconds]}` as fuel left per window. */
export function fuelWindows(record: Record<string, unknown>): FuelWindowInfo[] {
  const labels: Record<string, string> = { session: "5H", weekly: "WEEK", monthly: "MONTH" };
  const windows: FuelWindowInfo[] = [];
  for (const key of ["session", "weekly", "monthly"]) {
    const value = record[key];
    if (!Array.isArray(value) || typeof value[0] !== "number") continue;
    windows.push({
      key,
      label: labels[key] ?? key,
      left: Math.max(0, Math.min(100, Math.round(100 - value[0]))),
      resetAt: typeof value[1] === "number" ? Math.round(value[1] * 1000) : undefined,
    });
  }
  return windows;
}

function kindOf(kind: string): AccountKind {
  return KINDS.includes(kind as (typeof KINDS)[number]) ? (kind as AccountKind) : "other";
}

function commandOnPath(name: string, pathEnv = process.env.PATH ?? ""): boolean {
  return pathEnv.split(":").some((dir) => dir.length > 0 && fs.existsSync(path.join(dir, name)));
}

/** `CLAUDE_CONFIG_DIR` from a `ps -E` command line. Nothing else is kept. */
export function configDirFromPs(text: string): string | undefined {
  return text.match(/(?:^|\s)CLAUDE_CONFIG_DIR=(\S+)/)?.[1]?.replace(/\/$/, "");
}

type Listed = { id: string; kind: AccountKind; label: string; email?: string; dir?: string };

/** Accounts from Orcha's config, plus Claude, Codex, and Cursor when they are installed and not listed. */
export function listAccounts(input: {
  roots: AccountRoots;
  panes?: PaneAccount[];
  installed?: Partial<Record<(typeof KINDS)[number], boolean>>;
}): AccountInfo[] {
  const { roots } = input;
  const config = readJson(path.join(roots.orchaDir, "config.json"));
  const record = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  const hidden = new Set(Array.isArray(record.hidden_accounts) ? record.hidden_accounts.filter((id): id is string => typeof id === "string") : []);
  const listed: Listed[] = [];
  if (Array.isArray(record.accounts)) {
    for (const item of record.accounts) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = text(row.id);
      const kind = text(row.kind);
      if (!id || !kind) continue;
      listed.push({
        id,
        kind: kindOf(kind),
        label: text(row.label) ?? id,
        email: text(row.email),
        dir: text(row.dir) ? expand(text(row.dir) ?? "", roots.home) : undefined,
      });
    }
  }
  const installed = input.installed ?? {
    claude: commandOnPath("claude"),
    codex: commandOnPath("codex"),
    cursor: commandOnPath("cursor-agent"),
  };
  for (const kind of KINDS) {
    const id = kind === "claude" ? "claude-main" : kind;
    if (listed.some((account) => account.kind === kind) || hidden.has(id) || !installed[kind]) continue;
    listed.push({ id, kind, label: LABELS[kind] });
  }
  const activeId = text(readText(path.join(roots.orchaDir, "claude-active")));
  const active = listed.some((account) => account.id === activeId)
    ? activeId
    : listed.find((account) => account.kind === "claude" && !account.dir)?.id;
  const accounts: AccountInfo[] = listed.map((account) => {
    const profile = account.kind === "claude" ? claudeProfile(account, roots) : {};
    const email = profile.email ?? account.email;
    const plan = profile.plan;
    return {
      id: account.id,
      label: account.label,
      kind: account.kind,
      email,
      plan,
      dir: account.dir,
      signedIn: signedIn(account, roots, email),
      active: account.id === active,
      fuel: limitsOf(path.join(roots.limitsDir, `${account.id}.json`)),
      panes: [],
    };
  });
  for (const pane of input.panes ?? []) {
    const id = accountForPane(accounts, pane);
    accounts.find((account) => account.id === id)?.panes.push(pane.paneId);
  }
  return accounts;
}

function claudeProfile(account: Listed, roots: AccountRoots): { email?: string; plan?: string } {
  const saved = profileFields(readJson(path.join(roots.orchaDir, "claude-accounts", `${account.id}.json`)));
  if (saved.email || saved.plan) return saved;
  const file = account.dir ? path.join(account.dir, ".claude.json") : path.join(roots.home, ".claude.json");
  return profileFields(readJson(file));
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function signedIn(account: Listed, roots: AccountRoots, email: string | undefined): boolean {
  if (account.kind === "codex") return fs.existsSync(path.join(roots.home, ".codex", "auth.json"));
  if (account.kind === "cursor") {
    const file = readJson(path.join(roots.home, ".cursor", "cli-config.json"));
    const info = file && typeof file === "object" ? (file as Record<string, unknown>).authInfo : undefined;
    const cursorEmail = info && typeof info === "object" ? text((info as Record<string, unknown>).email) : undefined;
    return Boolean(cursorEmail);
  }
  if (account.kind === "claude") return Boolean(email);
  return false;
}

function accountForPane(accounts: AccountInfo[], pane: PaneAccount): string | undefined {
  const kind = kindOf(pane.kind);
  const same = accounts.filter((account) => account.kind === kind);
  if (kind !== "claude") return same[0]?.id;
  if (pane.configDir) {
    const dir = path.resolve(pane.configDir);
    const match = same.find((account) => account.dir && path.resolve(account.dir) === dir);
    if (match) return match.id;
  }
  return same.find((account) => account.active)?.id ?? same.find((account) => !account.dir)?.id;
}

function accountStamp(accounts: AccountInfo[], paneId: string): { id?: string; low: boolean } {
  const account = accounts.find((item) => item.panes.includes(paneId));
  return { id: account?.id, low: account ? fuelIsLow(account.fuel) : false };
}

export function stampAccounts(agents: Agent[], accounts: AccountInfo[]) {
  for (const agent of agents) {
    const stamp = accountStamp(accounts, agent.paneId);
    agent.accountId = stamp.id;
    agent.lowFuel = stamp.low;
  }
}

/** True when a new account list would change an Agent's account or low-fuel flag. Fuel percents alone do not. */
export function accountsAffectAgents(agents: Agent[], accounts: AccountInfo[]): boolean {
  return agents.some((agent) => {
    const stamp = accountStamp(accounts, agent.paneId);
    return agent.accountId !== stamp.id || (agent.lowFuel ?? false) !== stamp.low;
  });
}

const configCache = new LRUCache<string, { dir?: string }>({ max: 200, ttl: 30_000 });

/** A Claude pane's CLAUDE_CONFIG_DIR, read from its process env (protocol 22/23; cached 30 s). */
export async function paneConfigDir(link: OfficeLink, paneId: string): Promise<string | undefined> {
  const hit = configCache.get(paneId);
  if (hit) return hit.dir;
  try {
    const info = (await link.request("pane.process_info", { pane_id: paneId })) as { process_info?: { foreground_process_group_id?: number } };
    const pid = info.process_info?.foreground_process_group_id ?? 0;
    if (!pid) {
      configCache.set(paneId, {});
      return undefined;
    }
    const proc = Bun.spawn(["ps", "-E", "-ww", "-o", "command=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const command = await new Response(proc.stdout).text();
    await proc.exited;
    const dir = configDirFromPs(command);
    configCache.set(paneId, { dir });
    return dir;
  } catch {
    return undefined;
  }
}

// `accounts.list` takes about half a second; routes and the poll share one answer for 2 s, and a pushed
// `accounts.changed` list stands until the next push. The file fallback is cheap and stays uncached.
const orchaCache = new LRUCache<string, AccountInfo[], OfficeLink>({
  max: 10,
  ttl: 2_000,
  fetchMethod: async (_key, _stale, { context }) => (await orchaAccounts(context)) ?? undefined,
});

export async function readOfficeAccounts(link: OfficeLink, roots: AccountRoots = defaultAccountRoots()): Promise<AccountInfo[]> {
  if (supports(link, "accounts.list")) {
    const fromOrcha = await orchaCache.fetch(roots.orchaDir, { context: link }).catch(() => undefined);
    if (fromOrcha) return fromOrcha;
  }
  const panes = await Promise.all(link.state().agents.map(async (agent): Promise<PaneAccount> => ({
    paneId: agent.paneId,
    kind: agent.kind,
    configDir: agent.kind === "claude" ? await paneConfigDir(link, agent.paneId) : undefined,
  })));
  return listAccounts({ roots, panes });
}

/** Keep a list Orcha pushed, so reads between pushes do not ask again. */
export function rememberAccounts(roots: AccountRoots, accounts: AccountInfo[]) {
  orchaCache.set(roots.orchaDir, accounts, { ttl: 60_000 });
}
