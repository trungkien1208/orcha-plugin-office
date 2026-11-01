import { protocolWarning } from "@easy-job/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pidAlive, readBridge } from "./instance.ts";
import { createClient } from "./orcha/client.ts";
import { connect } from "./orcha/transport.ts";

export type Check = { name: string; ok: boolean; detail: string; fix?: string };

/** Every file a manifest names, relative to `public/`. */
export function manifestFiles(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith("office/") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(manifestFiles);
  if (value && typeof value === "object") return Object.values(value).flatMap(manifestFiles);
  return [];
}

export function checkManifest(publicDir: string): Check {
  const file = path.join(publicDir, "office", "manifest.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as { characters?: { cast?: string[] } };
    const missing = manifestFiles(manifest).filter((item) => !fs.existsSync(path.join(publicDir, item)));
    const cast = manifest.characters?.cast?.length ?? 0;
    if (missing.length) return { name: "Office art", ok: false, detail: `${missing.length} files missing, e.g. ${missing[0]}`, fix: "Ask Codex to finish docs/art-brief.md, or the Floor uses placeholders for those." };
    return { name: "Office art", ok: true, detail: `manifest valid, cast of ${cast}` };
  } catch {
    return { name: "Office art", ok: false, detail: `cannot read ${file}`, fix: "The Floor will draw placeholders. Restore packages/web/public/office/manifest.json." };
  }
}

function which(binary: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const candidate = path.join(dir, binary);
    if (dir && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function mode(file: string): number | null {
  try {
    return fs.statSync(file).mode & 0o777;
  } catch {
    return null;
  }
}

export async function runDoctor(opts: { socketPath: string; home: string; publicDir: string }): Promise<Check[]> {
  const checks: Check[] = [];
  const orcha = which("orcha");
  checks.push(orcha
    ? { name: "Orcha installed", ok: true, detail: orcha }
    : { name: "Orcha installed", ok: false, detail: "`orcha` is not on PATH", fix: "curl -fsSL https://raw.githubusercontent.com/trungkien1208/orcha/HEAD/install.sh | sh" });
  if (!fs.existsSync(opts.socketPath)) {
    checks.push({ name: "Orcha running", ok: false, detail: `no socket at ${opts.socketPath}`, fix: "Type `orcha` in a terminal (or `orcha server` for a headless server)." });
  } else {
    try {
      const client = createClient(() => connect(opts.socketPath), 3000);
      const snapshot = (await client.request("session.snapshot")) as { snapshot?: { protocol?: number; version?: string; workspaces?: unknown[]; agents?: unknown[] } };
      const snap = snapshot.snapshot ?? {};
      let protocol = snap.protocol;
      if (protocol == null) {
        try {
          const pong = (await client.request("ping", {}, 2000)) as { protocol?: number };
          if (typeof pong.protocol === "number") protocol = pong.protocol;
        } catch {
          /* the snapshot's protocol, if any, still stands */
        }
      }
      checks.push({ name: "Orcha running", ok: true, detail: `${opts.socketPath} · ${snap.workspaces?.length ?? 0} Projects · ${snap.agents?.length ?? 0} Agents` });
      const warning = protocolWarning(protocol);
      checks.push(warning
        ? { name: "Orcha protocol", ok: false, detail: warning, fix: "Easy Job still works. Update Orcha or Easy Job." }
        : protocol == null
          ? { name: "Orcha protocol", ok: false, detail: "protocol unknown is untested", fix: "Easy Job still works; some actions may fail. Update Orcha or Easy Job." }
          : { name: "Orcha protocol", ok: true, detail: `${protocol} (Orcha ${snap.version ?? "?"})` });
    } catch (error) {
      checks.push({ name: "Orcha running", ok: false, detail: `socket did not answer: ${(error as Error).message}`, fix: "Restart Orcha: quit it and type `orcha` again." });
    }
  }
  const claude = path.join(os.homedir(), ".claude", "projects"), codex = path.join(os.homedir(), ".codex", "sessions");
  checks.push({ name: "Claude transcripts", ok: fs.existsSync(claude), detail: fs.existsSync(claude) ? claude : "not found", fix: fs.existsSync(claude) ? undefined : "Claude Conversations fall back to terminal text." });
  checks.push({ name: "Codex transcripts", ok: fs.existsSync(codex), detail: fs.existsSync(codex) ? codex : "not found", fix: fs.existsSync(codex) ? undefined : "Codex Conversations fall back to terminal text." });
  const homeMode = mode(opts.home);
  checks.push(homeMode == null
    ? { name: "Data folder", ok: true, detail: `${opts.home} (created on first start)` }
    : { name: "Data folder", ok: homeMode === 0o700, detail: `${opts.home} mode ${homeMode.toString(8)}`, fix: homeMode === 0o700 ? undefined : `chmod 700 ${opts.home}` });
  const bridge = readBridge(opts.home);
  checks.push(bridge && pidAlive(bridge.pid)
    ? { name: "Bridge", ok: true, detail: `running (pid ${bridge.pid}) on http://127.0.0.1:${bridge.port}` }
    : { name: "Bridge", ok: true, detail: "not running; `easy-job` starts it" });
  checks.push(checkManifest(opts.publicDir));
  return checks;
}

export function formatChecks(checks: Check[]): string {
  return checks
    .map((check) => `${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}${!check.ok && check.fix ? `\n    fix: ${check.fix}` : ""}`)
    .join("\n");
}
