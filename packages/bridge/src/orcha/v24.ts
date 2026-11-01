// Orcha protocol 24 (models, accounts, questions, seen marks, hand-off), behind feature detection. Every function
// returns null when the connected Orcha does not offer the method, so callers keep their protocol 22 path.
import type { AccountInfo, FuelWindowInfo, ModelCatalog, ModelOption, ModelSettings, SwitchMode, SwitchPlan } from "@easy-job/shared";
import type { OfficeLink } from "./link.ts";

export const supports = (link: OfficeLink, method: string) => link.capabilities?.()?.methods?.includes(method) ?? false;
export const hasFeature = (link: OfficeLink, feature: string) => link.capabilities?.()?.features?.includes(feature) ?? false;

type OrchaModel = {
  id: string;
  name?: string;
  description?: string;
  efforts?: string[];
  default_effort?: string;
  fast_available?: boolean;
  fast_efforts?: string[];
  variants?: Array<{ id: string; name?: string; effort?: string; fast?: boolean }>;
};

/** `agent.models` as the app's catalog. */
export async function orchaModels(link: OfficeLink, kind: string): Promise<ModelCatalog | null> {
  if (!supports(link, "agent.models")) return null;
  const result = (await link.request("agent.models", { kind }, 20_000)) as { models?: OrchaModel[]; source?: string };
  const models: ModelOption[] = (result.models ?? []).map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: model.description,
    efforts: model.efforts ?? [],
    defaultEffort: model.default_effort,
    fast: model.fast_available ?? false,
    ...(model.fast_efforts ? { fastEfforts: model.fast_efforts } : {}),
    ...(model.variants?.length ? { variants: model.variants.map((v) => ({ model: v.id, name: v.name, effort: v.effort, fast: v.fast ?? false })) } : {}),
  }));
  return { kind, models, source: `Orcha · ${result.source ?? "agent.models"}`, fetchedAt: new Date().toISOString() };
}

/** `agent.configure`: model, effort and fast as one action; Orcha queues it while the agent is busy. */
export async function orchaConfigure(link: OfficeLink, paneId: string, settings: ModelSettings): Promise<{ queued: boolean } | null> {
  if (!supports(link, "agent.configure")) return null;
  const params: Record<string, unknown> = { pane_id: paneId };
  if (settings.model) params.model = settings.model;
  if (settings.effort !== undefined) params.effort = settings.effort;
  if (settings.fast !== undefined) params.fast = settings.fast;
  const result = (await link.request("agent.configure", params, 20_000)) as { outcome?: string };
  return { queued: result.outcome === "queued" };
}

type OrchaAccount = {
  id: string;
  kind: string;
  label: string;
  email?: string;
  plan?: string;
  signed_in?: boolean;
  is_default?: boolean;
  pane_ids?: string[];
  fuel?: Array<{ key: string; label: string; left_percent: number; reset_at?: number }>;
};

export function mapAccounts(raw: unknown[]): AccountInfo[] {
  const accounts = raw.filter((item): item is OrchaAccount => !!item && typeof item === "object" && typeof (item as OrchaAccount).id === "string");
  return accounts.map((account) => ({
    id: account.id,
    label: account.label || account.id,
    kind: (["claude", "codex", "cursor"].includes(account.kind) ? account.kind : "other") as AccountInfo["kind"],
    email: account.email,
    plan: account.plan,
    signedIn: account.signed_in ?? false,
    active: account.is_default ?? false,
    fuel: (account.fuel ?? []).map((window): FuelWindowInfo => ({ key: window.key, label: window.label, left: window.left_percent, resetAt: window.reset_at ? window.reset_at * 1000 : undefined })),
    panes: account.pane_ids ?? [],
  }));
}

/** `accounts.list`: profiles and fuel, never credentials. */
export async function orchaAccounts(link: OfficeLink): Promise<AccountInfo[] | null> {
  if (!supports(link, "accounts.list")) return null;
  const result = (await link.request("accounts.list", {})) as { accounts?: OrchaAccount[] };
  return mapAccounts(result.accounts ?? []);
}

const ORCHA_MODE: Record<SwitchMode, string> = { keychain: "keep", restart: "restart", handoff: "handoff" };

type OrchaPlan = { allowed?: boolean; reason?: string; also_moves?: string[]; needs_idle?: boolean; session_linked?: boolean };
const mapPlan = (mode: SwitchMode, plan: OrchaPlan): SwitchPlan => ({
  mode,
  allowed: plan.allowed ?? false,
  reason: plan.reason,
  alsoMoves: plan.also_moves ?? [],
  needsIdle: plan.needs_idle ?? false,
  ...(plan.session_linked !== undefined ? { sessionLinked: plan.session_linked } : {}),
});

/** `accounts.plan`: a dry run of moving a pane to another account. */
export async function orchaPlan(link: OfficeLink, paneId: string, accountId: string, mode: SwitchMode): Promise<SwitchPlan | null> {
  if (!supports(link, "accounts.plan")) return null;
  const result = (await link.request("accounts.plan", { pane_id: paneId, account_id: accountId, mode: ORCHA_MODE[mode] })) as { plan?: OrchaPlan };
  return mapPlan(mode, result.plan ?? {});
}

/** `accounts.switch`: the move itself; for a hand-off the result names the new pane. */
export async function orchaSwitch(
  link: OfficeLink,
  input: { paneId: string; accountId: string; mode: SwitchMode; moveAll?: boolean; whenIdle?: boolean },
): Promise<{ paneId: string; queued: boolean } | null> {
  if (!supports(link, "accounts.switch")) return null;
  const result = (await link.request(
    "accounts.switch",
    { pane_id: input.paneId, account_id: input.accountId, mode: ORCHA_MODE[input.mode], move_all: input.moveAll ?? false, when_idle: input.whenIdle ?? false },
    60_000,
  )) as { outcome?: string; pane_id?: string };
  return { paneId: result.pane_id ?? input.paneId, queued: result.outcome === "queued" };
}

/** `accounts.login`: the agent's sign-in in its own pane, without taking focus. */
export async function orchaLogin(link: OfficeLink, accountId: string): Promise<{ paneId?: string } | null> {
  if (!supports(link, "accounts.login")) return null;
  const result = (await link.request("accounts.login", { account_id: accountId })) as { pane_id?: string };
  return { paneId: result.pane_id };
}

/** `agent.handoff`: a new agent beside the old one, with notes from its transcript. */
export async function orchaHandoff(
  link: OfficeLink,
  input: { paneId: string; to: { kind?: string; accountId?: string }; notes: "full" | "summary" },
): Promise<{ paneId: string } | null> {
  if (!supports(link, "agent.handoff")) return null;
  const to: Record<string, string> = {};
  if (input.to.kind) to.kind = input.to.kind;
  if (input.to.accountId) to.account_id = input.to.accountId;
  const result = (await link.request("agent.handoff", { pane_id: input.paneId, to, notes: input.notes }, 60_000)) as { pane_id: string };
  return { paneId: result.pane_id };
}

export type OrchaQuestion = {
  text: string;
  options: Array<{ label: string; key?: string; description?: string; selected?: boolean; checkbox?: boolean; checked?: boolean }>;
  multi_select?: boolean;
  free_text?: boolean;
};

/** `agent.question`: a blocked agent's question and options as data. */
export async function orchaQuestion(link: OfficeLink, paneId: string): Promise<{ question: OrchaQuestion | null } | null> {
  if (!supports(link, "agent.question")) return null;
  const result = (await link.request("agent.question", { pane_id: paneId })) as { question?: OrchaQuestion | null };
  return { question: result.question ?? null };
}

/** `agent.answer`: pick an option by key or label, several for a multi-select, or type free text. */
export async function orchaAnswer(link: OfficeLink, paneId: string, answer: { option?: string; options?: string[]; text?: string }): Promise<boolean> {
  if (!supports(link, "agent.answer")) return false;
  await link.request("agent.answer", { pane_id: paneId, ...answer });
  return true;
}

/** `agent.mark_seen`: done becomes idle in Orcha too, without focusing the pane. */
export async function orchaMarkSeen(link: OfficeLink, paneId: string, completionSeq: number): Promise<boolean> {
  if (!supports(link, "agent.mark_seen")) return false;
  await link.request("agent.mark_seen", { pane_id: paneId, completion_seq: completionSeq });
  return true;
}
