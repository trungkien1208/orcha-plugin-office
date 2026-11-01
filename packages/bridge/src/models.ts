import type { ModelCatalog, ModelOption, ModelSettings } from "@easy-job/shared";
import type { OfficeLink } from "./orcha/link.ts";
import { orchaModels, supports } from "./orcha/v24.ts";
import { LRUCache } from "lru-cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import stripAnsi from "strip-ansi";

type CodexModel = {
  slug: string;
  display_name?: string;
  description?: string;
  visibility?: string;
  default_reasoning_level?: string;
  supported_reasoning_levels?: { effort: string }[];
  service_tiers?: { id: string; name: string }[];
};
type ClaudeModel = {
  value: string;
  resolvedModel?: string;
  displayName: string;
  description?: string;
  supportedEffortLevels?: string[];
  supportsFastMode?: boolean;
};

export function codexModels(raw: { models?: CodexModel[] }): ModelOption[] {
  return (raw.models ?? [])
    .filter((m) => m.visibility === "list")
    .map((m) => ({
      id: m.slug,
      name: m.display_name ?? m.slug,
      description: m.description,
      efforts: m.supported_reasoning_levels?.map((e) => e.effort) ?? [],
      defaultEffort: m.default_reasoning_level,
      fast: m.service_tiers?.some((t) => t.id === "priority" || t.name.toLowerCase() === "fast") ?? false,
    }));
}

export function claudeModels(models: ClaudeModel[]): ModelOption[] {
  const unique = new Map<string, ModelOption>();
  for (const m of models) {
    const id = m.resolvedModel ?? m.value,
      aliases = unique.get(id)?.aliases ?? [];
    unique.set(id, {
      id,
      name: m.displayName,
      aliases: [...new Set([...aliases, m.value])],
      description: m.description,
      efforts: m.supportedEffortLevels ?? [],
      fast: m.supportsFastMode === true,
    });
  }
  return [...unique.values()];
}

/** Keep the exact IDs advertised by Cursor; effort/speed map to real variants. */
export function cursorModels(raw: string): ModelOption[] {
  const groups = new Map<string, ModelOption>();
  for (const line of stripAnsi(raw).split("\n")) {
    const match = line.match(/^([\w.:-]+) - (.+)$/);
    if (!match?.[1] || !match[2]) continue;
    const model = match[1],
      fast = model.endsWith("-fast"),
      standard = model.replace(/-fast$/, "");
    const effort = standard.match(/-(none|minimal|low|medium|high|xhigh|max|ultra)$/)?.[1];
    const id = effort ? standard.slice(0, -effort.length - 1) : standard;
    const entry = groups.get(id) ?? { id, name: id, efforts: [], fast: false, variants: [] };
    entry.variants?.push({ model, name: match[2], effort, fast });
    if (!entry.defaultEffort && effort) entry.defaultEffort = effort;
    if (effort && !entry.efforts.includes(effort)) entry.efforts.push(effort);
    entry.fast ||= fast;
    if (!effort && !fast) entry.name = match[2].replace(/ \(default\)$/, "");
    groups.set(id, entry);
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    defaultEffort: entry.variants?.some((v) => v.effort === undefined && !v.fast) ? undefined : entry.defaultEffort,
  }));
}

async function claudeCatalog(): Promise<ModelOption[]> {
  const proc = Bun.spawn(["claude", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"], {
    cwd: os.tmpdir(),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  });
  const timer = setTimeout(() => proc.kill(), 15_000);
  try {
    proc.stdin.write(
      `${JSON.stringify({ type: "control_request", request_id: "models", request: { subtype: "initialize" } })}\n`,
    );
    let buffer = "";
    for await (const chunk of proc.stdout) {
      buffer += Buffer.from(chunk).toString("utf8");
      if (buffer.length > 2_000_000) throw new Error("Claude model response is too large");
      while (buffer.includes("\n")) {
        const newline = buffer.indexOf("\n");
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (message.type === "control_response" && message.response?.request_id === "models") {
            // Only expose model capabilities, never the account/credential fields in initialization.
            const models = message.response.response?.models;
            if (!Array.isArray(models)) throw new Error("Claude did not provide a model catalog");
            return claudeModels(models);
          }
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      }
    }
    throw new Error("Claude model catalog unavailable");
  } finally {
    clearTimeout(timer);
    proc.kill();
    await proc.exited;
  }
}

// Orcha catalogs for 5 minutes, CLI catalogs for 1 minute; a failed read is dropped so the next call retries.
const catalogs = new LRUCache<string, ModelCatalog, OfficeLink | undefined>({
  max: 20,
  ttl: 60_000,
  fetchMethod: async (key, _stale, { context }) => {
    const [source, kind = ""] = key.split(":");
    if (source === "orcha") return context ? ((await orchaModels(context, kind)) ?? undefined) : undefined;
    return readCatalog(kind);
  },
});

/** The catalog for an agent kind: Orcha's `agent.models` when the link offers it, else each CLI's own cache. */
export async function listModels(kind: string, link?: OfficeLink): Promise<ModelCatalog> {
  if (link && supports(link, "agent.models")) {
    // models_unavailable or an older answer shape: the CLI caches below still work.
    const key = `orcha:${kind}`;
    const fromOrcha = await catalogs.fetch(key, { context: link, ttl: 5 * 60_000 }).catch(() => undefined);
    if (fromOrcha) return fromOrcha;
  }
  const key = `cli:${kind}`;
  const catalog = (await catalogs.fetch(key)) ?? (await readCatalog(kind));
  if (catalog.error) catalogs.delete(key);
  return catalog;
}

async function readCatalog(kind: string): Promise<ModelCatalog> {
  let models: ModelOption[] = [],
    source = "Agent catalog";
  try {
    if (kind === "codex") {
      source = "Codex local model catalog";
      const file = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "models_cache.json");
      models = codexModels(JSON.parse(fs.readFileSync(file, "utf8")));
    } else if (kind === "claude") {
      source = "Claude Code model catalog";
      models = await claudeCatalog();
    } else if (kind === "cursor") {
      source = "Cursor account model catalog";
      const proc = Bun.spawn(["agent", "models"], { stdout: "pipe", stderr: "ignore" });
      const timer = setTimeout(() => proc.kill(), 15_000);
      try {
        const raw = await new Response(proc.stdout).text();
        if ((await proc.exited) !== 0) throw new Error("Cursor model catalog unavailable");
        models = cursorModels(raw);
      } finally {
        clearTimeout(timer);
        proc.kill();
      }
    }
    if (!models.length) throw new Error("No model catalog available. Refresh after signing in to the Agent.");
    return { kind, models, source, fetchedAt: new Date().toISOString() };
  } catch (error) {
    return {
      kind,
      models: [],
      source,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Model catalog unavailable",
    };
  }
}

export function resolveSettings(kind: string, settings: ModelSettings, models: ModelOption[]): ModelSettings {
  if ((settings.effort !== undefined || settings.fast !== undefined) && !["codex", "claude", "cursor"].includes(kind))
    throw new Error("This Agent does not support effort or speed selection");
  const option = models.find(
    (m) =>
      m.id === settings.model ||
      m.aliases?.includes(settings.model) ||
      m.variants?.some((v) => v.model === settings.model),
  );
  if (settings.effort !== undefined && !option?.efforts.includes(settings.effort))
    throw new Error("This model does not support the selected effort");
  if (settings.fast === true && !option?.fast) throw new Error("Fast is not available for this model");
  if (kind === "cursor" && option?.variants) {
    const current = option.variants.find((v) => v.model === settings.model);
    const effort =
      settings.effort ??
      current?.effort ??
      (option.variants.some((v) => v.effort === undefined && !v.fast) ? undefined : option.defaultEffort);
    const fast = settings.fast ?? current?.fast ?? false;
    const variant = option.variants.find((v) => v.effort === effort && v.fast === fast);
    if (!variant) throw new Error("This effort and speed combination is not available");
    return { model: variant.model };
  }
  return settings;
}

export function modelCommands(kind: string, settings: ModelSettings): string[] {
  const { model, effort, fast } = settings;
  if (kind === "codex")
    return [
      `/model ${model}${effort ? ` --reasoning ${effort}` : ""}${fast !== undefined ? ` --speed ${fast ? "fast" : "standard"}` : ""}`,
    ];
  if (kind === "claude")
    return [
      `/model ${model}`,
      ...(effort ? [`/effort ${effort}`] : []),
      ...(fast !== undefined ? [`/fast ${fast ? "on" : "off"}`] : []),
    ];
  return [`/model ${model}`];
}
