/** Batch 1 wire contract, local until the shared/backend branch is merged. All new HTTP calls live here. */
import type { Agent, ConversationItem, ModelCatalog, ModelSettings } from "@easy-job/shared";
import { token } from "./api.ts";
export type AccountKind = "claude" | "codex" | "cursor" | "other";
export type FuelWindowInfo = { key: string; label: string; left: number; resetAt?: number };
export type AccountInfo = {
  id: string;
  label: string;
  kind: AccountKind;
  email?: string;
  plan?: string;
  dir?: string;
  signedIn: boolean;
  active: boolean;
  fuel: FuelWindowInfo[];
  panes: string[];
};
export type SwitchMode = "keychain" | "restart" | "handoff";
export type SwitchPlan = {
  mode: SwitchMode;
  allowed: boolean;
  reason?: string;
  alsoMoves: string[];
  sessionLinked?: boolean;
  needsIdle: boolean;
};
export type Capabilities = { accountApi: boolean; handoff: boolean };
export type AccountAgent = Agent & { accountId?: string; lowFuel?: boolean };
export type ThreadItem = ConversationItem & { paneId: string; from?: string };
export type Feature<T> = { available: true; data: T } | { available: false; reason: string };
export class AccountsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const part = encodeURIComponent;
export async function accountRequest<T>(path: string, body?: unknown): Promise<Feature<T>> {
  const headers: Record<string, string> = {};
  const auth = token();
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 404)
    return { available: false, reason: "Feature unavailable: this bridge does not support it yet." };
  if (!response.ok) throw new AccountsError(response.status, data.error || `Request failed (${response.status})`);
  return { available: true, data };
}
export const listAccounts = () => accountRequest<AccountInfo[]>("/api/accounts");
export const startOrcha = () => accountRequest<{ message: string }>("/api/orcha/start", {});
export const listModels = (kind: string) => accountRequest<ModelCatalog>(`/api/models?kind=${part(kind)}`);
export async function changeModel(
  agent: Agent,
  model: string,
  options: Omit<ModelSettings, "model"> = {},
): Promise<Feature<{ queued: boolean }>> {
  if (!/^[\w.:/-]{1,80}$/.test(model))
    throw new Error("Use a model name of 1–80 letters, digits, dots, slashes, colons or hyphens.");
  if (agent.status === "blocked") throw new AccountsError(409, "Answer the current question before changing model.");
  const result = await accountRequest<{ queued: boolean }>(`/api/agents/${part(agent.paneId)}/model`, {
    model,
    ...options,
  });
  if (result.available) return result;
  if (options.effort !== undefined || options.fast !== undefined)
    return {
      available: false,
      reason: "This bridge does not support effort and speed settings. Restart it with the updated version.",
    };
  if (agent.status === "working")
    return { available: false, reason: "Model queue unavailable on this bridge. Wait until the Agent is idle." };
  const fallback = await accountRequest<unknown>(`/api/agents/${part(agent.paneId)}/prompt`, {
    text: `/model ${model}`,
  });
  return fallback.available ? { available: true, data: { queued: false } } : fallback;
}
export const planSwitch = (pane: string, accountId: string, mode: SwitchMode) =>
  accountRequest<SwitchPlan>(`/api/agents/${part(pane)}/account/plan`, { accountId, mode });
export const switchAccount = (
  pane: string,
  accountId: string,
  mode: SwitchMode,
  options: { moveAll?: boolean; whenIdle?: boolean } = {},
) => accountRequest<{ ok: true; paneId: string }>(`/api/agents/${part(pane)}/account`, { accountId, mode, ...options });
export const loginAccount = (id: string) => accountRequest<{ paneId: string }>(`/api/accounts/${part(id)}/login`, {});
export const handoffAgent = (pane: string, to: { kind?: AccountKind; accountId?: string }, mode: "full" | "summary") =>
  accountRequest<{ paneId: string }>(`/api/agents/${part(pane)}/handoff`, { to, mode });
export const teamPrompt = (ws: string, to: string[], text: string) => {
  if (to.length < 1 || to.length > 5) throw new Error("Choose between one and five teammates.");
  return accountRequest<{ results: { paneId: string; ok: boolean; error?: string }[] }>(
    `/api/projects/${part(ws)}/prompt`,
    { to, text },
  );
};
export const teamThread = (ws: string, before?: string) =>
  accountRequest<{ items: ThreadItem[] }>(
    `/api/projects/${part(ws)}/thread?limit=50${before ? `&before=${part(before)}` : ""}`,
  );
export async function stopAndSwitch(pane: string, accountId: string) {
  const stopped = await accountRequest<unknown>(`/api/agents/${part(pane)}/interrupt`, {});
  if (!stopped.available) return stopped;
  for (let n = 0; n < 20; n++) {
    const plan = await planSwitch(pane, accountId, "restart");
    if (!plan.available) return plan;
    if (!plan.data.needsIdle) {
      if (!plan.data.allowed || plan.data.sessionLinked === false)
        throw new Error(plan.data.reason || "The new plan does not allow resuming this session.");
      return switchAccount(pane, accountId, "restart");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The Agent has not become idle. No account switch was sent; check Orcha and try again.");
}
export const focusAccountPane = (pane: string) => accountRequest<unknown>(`/api/agents/${part(pane)}/focus`, {});
