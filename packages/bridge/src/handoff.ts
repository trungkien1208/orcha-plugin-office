import { ActionError } from "./actions.ts";
import fs from "node:fs";
import path from "node:path";

const KINDS = new Set(["claude", "codex", "cursor"]);

export function handoffScript(orchaDir: string): string {
  return path.join(orchaDir, "scripts", "handoff.py");
}

export function handoffReady(orchaDir: string): boolean {
  return fs.existsSync(handoffScript(orchaDir));
}

/** Run Orcha's hand-off script. It prints `pane <id>`. The Orcha binary is `HERDR_BIN_PATH`. */
export async function runHandoff(input: {
  paneId: string;
  kind: string;
  mode: "full" | "summary";
  orchaDir: string;
  orchaBin: string;
  configDir?: string;
}): Promise<{ paneId: string }> {
  if (!KINDS.has(input.kind)) throw new ActionError(400, "Hand off needs claude, codex, or cursor");
  const script = handoffScript(input.orchaDir);
  if (!fs.existsSync(script)) throw new ActionError(501, "Hand off script is not installed");
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value != null) env[key] = value;
  env.HERDR_BIN_PATH = input.orchaBin;
  if (input.configDir) env.CLAUDE_CONFIG_DIR = input.configDir;
  const proc = Bun.spawn(["python3", script, input.paneId, input.kind, input.mode], {
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new ActionError(502, "Hand off failed");
  const paneId = out.match(/pane\s+(\S+)/)?.[1];
  if (!paneId) throw new ActionError(502, "Hand off did not name a pane");
  return { paneId };
}
