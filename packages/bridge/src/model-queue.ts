import type { Agent, ModelSettings } from "@easy-job/shared";
import { orchaConfigure, supports } from "./orcha/v24.ts";
import { configureAgentModel, ActionError } from "./actions.ts";
import { listModels, resolveSettings } from "./models.ts";
import type { ActivityLog } from "./state/activity.ts";
import type { OfficeLink } from "./orcha/link.ts";

const MODEL = /^[\w.:/-]{1,80}$/;
const pending = new Map<string, { settings: ModelSettings; agentKey: string }>();

/** One queued `/model` per Agent. Idle sends it now. */
export async function requestModel(
  link: OfficeLink,
  agent: Agent,
  model: string,
  activity: ActivityLog,
  options: { effort?: string; fast?: boolean } = {},
  catalog = listModels,
): Promise<{ queued: boolean }> {
  if (!MODEL.test(model)) throw new ActionError(400, "Invalid model");
  // Protocol 24: Orcha checks the settings against agent.models, types the commands and queues them while the agent
  // is busy or blocked. Cursor's picker cannot be driven, so Cursor keeps the slash-command path below.
  if (agent.kind !== "cursor" && supports(link, "agent.configure")) {
    try {
      const result = await orchaConfigure(link, agent.paneId, { model, ...options });
      if (result) {
        pending.delete(agent.paneId);
        activity.append({ kind: "action", text: `Model ${agent.name}: ${model}${options.effort ? ` · ${options.effort}` : ""}${options.fast !== undefined ? ` · ${options.fast ? "Fast" : "Standard"}` : ""}${result.queued ? " (queued)" : ""}`, paneId: agent.paneId, agentKey: agent.agentKey, workspaceId: agent.workspaceId });
        return result;
      }
    } catch (error) {
      throw new ActionError(400, error instanceof Error ? error.message : "Orcha could not change the model");
    }
  }
  if (agent.status === "blocked") throw new ActionError(409, "Answer its question first");
  let settings: ModelSettings = { model, ...options };
  if (options.effort !== undefined || options.fast !== undefined || agent.kind === "cursor") {
    try {
      settings = resolveSettings(agent.kind, settings, (await catalog(agent.kind)).models);
    } catch (error) {
      throw new ActionError(400, error instanceof Error ? error.message : "Invalid model settings");
    }
  }
  if (agent.status !== "idle") {
    pending.set(agent.paneId, { settings, agentKey: agent.agentKey });
    return { queued: true };
  }
  pending.delete(agent.paneId);
  await configureAgentModel(link, agent.paneId, settings, activity);
  return { queued: false };
}

/** Send a queued model once its Agent is idle. */
export async function flushModels(link: OfficeLink, agents: Agent[], activity: ActivityLog) {
  if (pending.size === 0) return;
  for (const [paneId, request] of pending)
    if (!agents.some((a) => a.paneId === paneId && a.agentKey === request.agentKey)) pending.delete(paneId);
  for (const agent of agents) {
    if (agent.status !== "idle") continue;
    const request = pending.get(agent.paneId);
    if (!request) continue;
    pending.delete(agent.paneId);
    await configureAgentModel(link, agent.paneId, request.settings, activity);
  }
}
