import type { CurrentModelState, ModelOption, ModelSettings } from "@easy-job/shared";
import { hasFeature } from "./v24.ts";
import stripAnsi from "strip-ansi";
import type { OfficeLink } from "./link.ts";
import { ActionError } from "../actions.ts";
import { listModels } from "../models.ts";
import { locateTranscript } from "../conversation/load.ts";
import { readSessionModel } from "../conversation/model-state.ts";

const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
const fastFooterSessions = new Set<string>();

/** Only the footer below the Codex composer is authoritative, never a model name in chat text. */
export function codexFooterModel(text: string, models: ModelOption[]): Partial<ModelSettings> {
  const lines = stripAnsi(text).split("\n").slice(-10);
  let prompt = -1;
  for (let i = lines.length - 1; i >= 0; i--)
    if (/^\s*›/.test(lines[i] ?? "")) {
      prompt = i;
      break;
    }
  if (prompt < 0) return {};
  for (const line of lines.slice(prompt + 1)) {
    const match = line.match(
      /^\s*(GPT-[\w. -]+?)\s+(none|minimal|low|medium|high|xhigh|max|ultra)(?:\s+(fast|standard|flex))?\s*·/i,
    );
    if (!match?.[1] || !match[2]) continue;
    const model = models.find(
      (m) => normalize(m.id) === normalize(match[1] ?? "") || normalize(m.name) === normalize(match[1] ?? ""),
    );
    if (!model) continue;
    const explicitSpeed =
      match[3]?.toLowerCase() ?? line.match(/·\s*(?:⚡\s*)?(fast|standard)\s*(?:·|$)/i)?.[1]?.toLowerCase();
    return {
      model: model.id,
      effort: match[2].toLowerCase(),
      ...(explicitSpeed ? { fast: explicitSpeed === "fast" } : {}),
    };
  }
  return {};
}

export function cursorFooterModel(text: string, models: ModelOption[]): Partial<ModelSettings> {
  const lines = stripAnsi(text).split("\n").slice(-10);
  let prompt = -1;
  for (let i = lines.length - 1; i >= 0; i--)
    if (/^\s*→/.test(lines[i] ?? "")) {
      prompt = i;
      break;
    }
  if (prompt < 0) return {};
  const label = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b\d+(?:\.\d+)?[km]\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  for (const line of lines.slice(prompt + 1)) {
    const match = line.match(/^\s*(.+?)\s*·\s*(?:MAX|Auto|[\d.,]+%)(?:\s*·|$)/i);
    if (!match?.[1]) continue;
    for (const model of models) {
      const variant = model.variants?.find((v) => label(v.name ?? v.model) === label(match[1] ?? ""));
      if (variant) return { model: variant.model, effort: variant.effort, fast: variant.fast };
      if (label(model.name) === label(match[1])) return { model: model.id };
    }
  }
  return {};
}

export async function currentModelState(
  link: OfficeLink,
  paneId: string,
  home?: string,
  catalogFor = listModels,
): Promise<CurrentModelState> {
  const agent = link.state().agents.find((a) => a.paneId === paneId);
  if (!agent) throw new ActionError(404, "No such Agent");
  const base = { paneId, agentKey: agent.agentKey, observedAt: Date.now() };
  // Protocol 24 observes model, effort and fast from each agent's own records: no transcript or footer reading here.
  if (hasFeature(link, "agent.model_state.observed") && agent.model) {
    return { ...base, model: agent.model, effort: agent.effort, fast: agent.fast, source: "orcha" };
  }
  let session: Partial<ModelSettings> = {};
  try {
    session = readSessionModel(
      locateTranscript({ kind: agent.kind, cwd: agent.cwd, session: agent.session?.value, home, transcriptPath: agent.session?.transcript_path }),
    );
  } catch {
    /* Agent session may disappear during a restart. */
  }
  let state: CurrentModelState = { ...base, ...session, source: session.model ? "session" : "unavailable" };
  if (agent.model)
    state = { ...base, ...(session.model === agent.model ? session : {}), model: agent.model, source: "orcha" };
  if (agent.kind === "codex" || agent.kind === "cursor") {
    try {
      const [read, catalog] = await Promise.all([
        link.request(
          "agent.read",
          { target: paneId, source: "visible", format: "text", strip_ansi: true, lines: 80 },
          3000,
        ),
        catalogFor(agent.kind),
      ]);
      const footer = (agent.kind === "codex" ? codexFooterModel : cursorFooterModel)(
        (read as { read?: { text?: string } }).read?.text ?? "",
        catalog.models,
      );
      if (agent.kind === "codex" && footer.model) {
        const key = `${paneId}:${agent.agentKey}`;
        // Codex omits the tier label at Standard speed. Learn that this exact
        // session exposes Fast in its footer before interpreting its removal.
        if (footer.fast === true) {
          if (fastFooterSessions.size > 256) fastFooterSessions.clear();
          fastFooterSessions.add(key);
        } else if (footer.fast === undefined && fastFooterSessions.has(key)) footer.fast = false;
      }
      if (footer.model)
        state = { ...base, ...(session.model === footer.model ? session : {}), ...footer, source: "terminal-footer" };
    } catch {
      /* No terminal read is required when Orcha or the session already has metadata. */
    }
  }
  const current = link.state().agents.find((a) => a.paneId === paneId);
  if (current?.agentKey !== agent.agentKey)
    throw new ActionError(409, "Agent session changed; refresh its current model");
  return state;
}
