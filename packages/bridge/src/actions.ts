import type { Agent } from "@easy-job/shared";
import { OrchaError } from "./orcha/client.ts";
import type { OfficeLink } from "./orcha/link.ts";
import { hasFeature, orchaAnswer, orchaMarkSeen } from "./orcha/v24.ts";
import type { ModelSettings } from "@easy-job/shared";
import { listModels, modelCommands, resolveSettings } from "./models.ts";
import type { ActivityLog } from "./state/activity.ts";
import { isSkinId } from "./state/local.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const KEYS = new Set(["enter", "esc", "y", "n", "up", "down", "tab", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

export class ActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Orcha is not accepting connections, or a request sat until it timed out. */
export function orchaUnreachable(error: unknown): boolean {
  if (error instanceof OrchaError && error.code === "timeout") return true;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  return (
    code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOENT" || code === "ECONNRESET" || code === "EPIPE"
  );
}

type ReadBody = { read?: { text?: string }; root_pane?: { pane_id?: string }; agent?: { pane_id?: string } };

function agentOf(link: OfficeLink, paneId: string): Agent {
  const agent = link.state().agents.find((item) => item.paneId === paneId);
  if (!agent) throw new ActionError(404, "No Agent in that pane");
  return agent;
}

async function call(link: OfficeLink, method: string, params: unknown, timeoutMs?: number): Promise<ReadBody> {
  try {
    return (await link.request(method, params, timeoutMs)) as ReadBody;
  } catch (error) {
    if (error instanceof OrchaError && error.code === "agent_blocked") {
      throw new ActionError(409, "Answer its question first");
    }
    if (orchaUnreachable(error)) throw new ActionError(503, "Orcha isn't answering");
    if (error instanceof OrchaError) throw new ActionError(502, error.message);
    throw error;
  }
}

const lanes = new Map<string, Promise<unknown>>();

function lane<T>(paneId: string, job: () => Promise<T>): Promise<T> {
  const previous = lanes.get(paneId) ?? Promise.resolve();
  const run = previous.then(job, job);
  lanes.set(
    paneId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function log(activity: ActivityLog, text: string, agent?: Agent, workspaceId?: string) {
  activity.append({
    kind: "action",
    text,
    paneId: agent?.paneId,
    agentKey: agent?.agentKey,
    workspaceId: workspaceId ?? agent?.workspaceId,
  });
}

export function markSeen(link: OfficeLink, paneId: string, activity: ActivityLog) {
  const agent = agentOf(link, paneId);
  if (agent.completionSeq == null) return agent;
  // Opening an Agent that is already seen is not news; only the first look after a finish is logged.
  let changed = false;
  link.updateLocal((draft) => {
    if (draft.seen[agent.agentKey] === agent.completionSeq) return;
    draft.seen[agent.agentKey] = agent.completionSeq as number;
    changed = true;
  });
  if (changed) {
    log(activity, `Seen ${agent.name}`, agent);
    // Protocol 24: done becomes idle in Orcha too, without focusing the pane.
    void orchaMarkSeen(link, paneId, agent.completionSeq).catch(() => undefined);
  }
  return link.state().agents.find((item) => item.paneId === paneId) ?? agent;
}

export async function promptAgent(link: OfficeLink, paneId: string, text: string, activity: ActivityLog) {
  return lane(paneId, async () => {
    const agent = agentOf(link, paneId);
    if (agent.status === "blocked") throw new ActionError(409, "Answer its question first");
    await call(link, "agent.prompt", { target: paneId, text });
    log(activity, `Prompt ${agent.name}: ${text}`, agent);
  });
}

export async function sendKeys(link: OfficeLink, paneId: string, keys: string[], activity: ActivityLog) {
  const normalized = keys.map((key) => key.toLowerCase());
  if (normalized.some((key) => !KEYS.has(key))) throw new ActionError(400, "That key is not allowed");
  return lane(paneId, async () => {
    const agent = agentOf(link, paneId);
    await call(link, "agent.send_keys", { target: paneId, keys: normalized });
    log(activity, `Keys ${agent.name}: ${normalized.join(" ")}`, agent);
  });
}

export type Answer = { text?: string; option?: string; options?: string[] };

export async function answerAgent(link: OfficeLink, paneId: string, answer: Answer | string, activity: ActivityLog) {
  const body: Answer = typeof answer === "string" ? { text: answer } : answer;
  return lane(paneId, async () => {
    const agent = agentOf(link, paneId);
    const shown = body.text ?? body.option ?? body.options?.join(", ") ?? "";
    // Protocol 24 picks options by key and checks the answer landed; older Orcha gets typed text.
    try {
      if (await orchaAnswer(link, paneId, body)) {
        log(activity, `Answer ${agent.name}: ${shown}`, agent);
        return;
      }
    } catch (error) {
      throw new ActionError(409, error instanceof Error ? error.message : "Orcha could not answer");
    }
    if (body.text === undefined) throw new ActionError(400, "This Orcha only takes typed answers");
    await call(link, "pane.send_input", { pane_id: paneId, text: body.text, keys: ["enter"] });
    log(activity, `Answer ${agent.name}: ${shown}`, agent);
  });
}

export async function interruptAgent(link: OfficeLink, paneId: string, activity: ActivityLog) {
  await sendKeys(link, paneId, ["esc"], activity);
}

export async function focusAgent(link: OfficeLink, paneId: string, activity: ActivityLog) {
  markSeen(link, paneId, activity);
  await call(link, "agent.focus", { target: paneId });
  const agent = agentOf(link, paneId);
  log(activity, `Open in Orcha ${agent.name}`, agent);
}

export async function renameAgent(link: OfficeLink, paneId: string, name: string, activity: ActivityLog) {
  const agent = agentOf(link, paneId);
  await call(link, "agent.rename", { target: paneId, name });
  log(activity, `Rename ${agent.name} to ${name}`, agent);
}

export function setSkin(link: OfficeLink, paneId: string, skin: string, activity: ActivityLog) {
  if (!isSkinId(skin)) throw new ActionError(400, "Unknown Skin");
  const agent = agentOf(link, paneId);
  link.updateLocal((draft) => {
    draft.skins[agent.agentKey] = skin;
  });
  log(activity, `Skin ${agent.name} → ${skin}`, agent);
}

export async function readQuestion(link: OfficeLink, paneId: string): Promise<string> {
  agentOf(link, paneId);
  const result = await call(link, "agent.read", {
    target: paneId,
    source: "detection",
    format: "text",
    strip_ansi: true,
    lines: 80,
  });
  return result.read?.text?.trim() ?? "";
}

export async function readTerminal(link: OfficeLink, paneId: string): Promise<string> {
  // Orcha captures alternate-screen `recent` history by sending scroll input.
  // Background conversation polling must never move the user's terminal.
  const result = await call(link, "agent.read", {
    target: paneId,
    // `scrollback` (protocol 24) reads history without scroll input; `visible` is the safe older fallback.
    source: hasFeature(link, "read.source.scrollback") ? "scrollback" : "visible",
    format: "text",
    strip_ansi: true,
    lines: 200,
  });
  return result.read?.text ?? "";
}

/**
 * Codex 0.165+ runs its hooks in a shared background server that keeps the env of the pane that first started it,
 * so Orcha's session hook reports to the wrong pane and the chat never links. `--no-daemon` keeps Codex in its pane.
 */
export function launchArgs(kind: string): string[] {
  return kind === "codex" ? ["--no-daemon"] : [];
}

/** CLI flags that pick a model: `--model` for Claude and Cursor, `-m` for Codex. Empty = the agent's default. */
export function modelArgs(kind: string, model?: string, settings: { effort?: string; fast?: boolean } = {}): string[] {
  const value = model?.trim();
  const args = value ? (kind.toLowerCase() === "codex" ? ["-m", value] : ["--model", value]) : [];
  if (kind === "codex") {
    if (settings.effort) args.push("-c", `model_reasoning_effort=${JSON.stringify(settings.effort)}`);
    if (settings.fast !== undefined)
      args.push("-c", `service_tier=${JSON.stringify(settings.fast ? "priority" : "default")}`);
  } else if (kind === "claude") {
    if (settings.effort) args.push("--effort", settings.effort);
    if (settings.fast !== undefined) args.push("--settings", JSON.stringify({ fastMode: settings.fast }));
  }
  return args;
}

export async function configureAgentModel(
  link: OfficeLink,
  paneId: string,
  settings: ModelSettings,
  activity: ActivityLog,
) {
  return lane(paneId, async () => {
    const agent = agentOf(link, paneId);
    if (agent.status !== "idle") throw new ActionError(409, "Wait until the Agent is idle");
    for (const text of modelCommands(agent.kind, settings)) await call(link, "agent.prompt", { target: paneId, text });
    log(
      activity,
      `Model ${agent.name}: ${settings.model}${settings.effort ? ` · ${settings.effort}` : ""}${settings.fast !== undefined ? ` · ${settings.fast ? "Fast" : "Standard"}` : ""}`,
      agent,
    );
  });
}

export async function startAgent(
  link: OfficeLink,
  workspaceId: string,
  input: { kind: string; name?: string; prompt?: string; model?: string; effort?: string; fast?: boolean },
  activity: ActivityLog,
) {
  const project = link.state().projects.find((item) => item.workspaceId === workspaceId);
  if (!project) throw new ActionError(404, "No such Project");
  let settings: ModelSettings = { model: input.model ?? "", effort: input.effort, fast: input.fast };
  if (input.effort !== undefined || input.fast !== undefined || input.kind === "cursor") {
    try {
      settings = resolveSettings(input.kind, settings, (await listModels(input.kind, link)).models);
    } catch (error) {
      throw new ActionError(400, error instanceof Error ? error.message : "Invalid model settings");
    }
  }
  if (hasFeature(link, "agent.start.workspace")) {
    // Protocol 24: one call opens the tab, starts the agent, applies the model and sends the prompt.
    const viaConfigure = input.kind !== "cursor";
    const extraArgs = [...launchArgs(input.kind), ...(viaConfigure ? [] : modelArgs(input.kind, settings.model, settings))];
    const started = await call(
      link,
      "agent.start",
      {
        workspace_id: workspaceId,
        kind: input.kind,
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(viaConfigure && settings.model ? { model: settings.model } : {}),
        ...(viaConfigure && settings.effort ? { effort: settings.effort } : {}),
        ...(viaConfigure && settings.fast !== undefined ? { fast: settings.fast } : {}),
        ...(extraArgs.length ? { args: extraArgs } : {}),
        ...(input.prompt?.trim() ? { prompt: input.prompt } : {}),
        timeout_ms: 30_000,
      },
      60_000,
    );
    const paneId = started.agent?.pane_id;
    if (!paneId) throw new ActionError(502, "Orcha did not return a pane");
    log(activity, `Start ${input.kind}${input.name ? ` ${input.name}` : ""} in ${project.label}`, undefined, workspaceId);
    return { paneId };
  }
  const args = [...launchArgs(input.kind), ...modelArgs(input.kind, settings.model, settings)];
  const created = await call(link, "tab.create", {
    workspace_id: workspaceId,
    cwd: project.cwd,
    focus: false,
  });
  const paneId = created.root_pane?.pane_id;
  if (!paneId) throw new ActionError(502, "Orcha did not return a pane");
  await lane(paneId, async () => {
    await call(
      link,
      "agent.start",
      {
        pane_id: paneId,
        kind: input.kind,
        name: input.name ?? "",
        timeout_ms: 30_000,
        ...(args.length ? { args } : {}),
      },
      35_000,
    );
    if (input.prompt?.trim()) await call(link, "agent.prompt", { target: paneId, text: input.prompt });
  });
  log(activity, `Start ${input.kind}${input.name ? ` ${input.name}` : ""} in ${project.label}`, undefined, workspaceId);
  return { paneId };
}

export async function broadcast(link: OfficeLink, workspaceId: string, text: string, activity: ActivityLog) {
  const project = link.state().projects.find((item) => item.workspaceId === workspaceId);
  if (!project) throw new ActionError(404, "No such Project");
  const results: Array<{ paneId: string; name: string; ok: boolean; error?: string }> = [];
  for (const agent of link.state().agents.filter((item) => item.workspaceId === workspaceId)) {
    if (agent.status === "blocked") {
      results.push({ paneId: agent.paneId, name: agent.name, ok: false, error: "Answer its question first" });
      continue;
    }
    try {
      await lane(agent.paneId, () => call(link, "agent.prompt", { target: agent.paneId, text }));
      results.push({ paneId: agent.paneId, name: agent.name, ok: true });
    } catch (error) {
      results.push({
        paneId: agent.paneId,
        name: agent.name,
        ok: false,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }
  log(activity, `Broadcast ${project.label}: ${text}`, undefined, workspaceId);
  return results;
}

export async function focusProject(link: OfficeLink, workspaceId: string, activity: ActivityLog) {
  const project = link.state().projects.find((item) => item.workspaceId === workspaceId);
  if (!project) throw new ActionError(404, "No such Project");
  await call(link, "workspace.focus", { workspace_id: workspaceId });
  log(activity, `Open Project ${project.label}`, undefined, workspaceId);
}

/** Close the Agent's pane in Orcha. This stops the agent process; the page asks first. */
export async function closeAgent(link: OfficeLink, paneId: string, activity: ActivityLog) {
  const agent = agentOf(link, paneId);
  await lane(paneId, () => call(link, "pane.close", { pane_id: paneId }));
  log(activity, `Removed ${agent.name}`, agent);
}

/** Close a Project's workspace in Orcha with every pane in it. The page asks for the Project name first. */
export async function closeProject(link: OfficeLink, workspaceId: string, confirmName: string, activity: ActivityLog) {
  const project = link.state().projects.find((item) => item.workspaceId === workspaceId);
  if (!project) throw new ActionError(404, "No such Project");
  if (confirmName.trim() !== project.label) throw new ActionError(400, `Type "${project.label}" to close it`);
  try {
    await link.request("workspace.close", { workspace_id: workspaceId });
  } catch (error) {
    if (error instanceof OrchaError && error.code === "workspace_group_close_required") {
      throw new ActionError(409, "This Project has linked worktrees open. Close them in Orcha first.");
    }
    if (error instanceof OrchaError) throw new ActionError(502, error.message);
    throw error;
  }
  log(activity, `Closed Project ${project.label}`, undefined, workspaceId);
}

/** New Project = new Orcha workspace in a folder (focus stays where the user is); optionally start a first Agent in it. */
export async function createProject(
  link: OfficeLink,
  input: {
    label: string;
    cwd: string;
    agent?: { kind: string; name?: string; prompt?: string; model?: string; effort?: string; fast?: boolean };
  },
  activity: ActivityLog,
): Promise<{ workspaceId: string }> {
  const cwd = path.resolve(input.cwd.replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new ActionError(400, `No folder at ${cwd}`);
  const before = new Set(link.state().projects.map((project) => project.workspaceId));
  const created = (await call(link, "workspace.create", { label: input.label.trim(), cwd, focus: false })) as {
    workspace?: { workspace_id?: string };
  };
  let workspaceId = created.workspace?.workspace_id ?? "";
  // The state refreshes from Orcha's event a moment later; wait for the new Project before starting an Agent in it.
  for (
    let i = 0;
    i < 40 &&
    !link
      .state()
      .projects.some(
        (project) => project.workspaceId === workspaceId || (!workspaceId && !before.has(project.workspaceId)),
      );
    i += 1
  )
    await Bun.sleep(100);
  if (!workspaceId)
    workspaceId = link.state().projects.find((project) => !before.has(project.workspaceId))?.workspaceId ?? "";
  log(activity, `New Project ${input.label.trim()}`, undefined, workspaceId);
  if (input.agent && workspaceId) await startAgent(link, workspaceId, input.agent, activity);
  return { workspaceId };
}

export async function agentKinds(link: OfficeLink): Promise<string[]> {
  try {
    const result = (await link.request("server.agent_manifests", {})) as { manifests?: Array<{ agent?: string }> };
    const kinds = (result.manifests ?? []).map((item) => item.agent).filter((kind): kind is string => Boolean(kind));
    const preferred = ["claude", "codex"];
    return [...preferred.filter((kind) => kinds.includes(kind)), ...kinds.filter((kind) => !preferred.includes(kind))];
  } catch {
    return ["claude", "codex"];
  }
}
