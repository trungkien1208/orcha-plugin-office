import fs from "node:fs";
import path from "node:path";

export type BridgeRecord = { pid: number; port: number; token: string; bridgeId: string };

export function bridgeFile(home: string): string {
  return path.join(home, "bridge.json");
}

export function readBridge(home: string): BridgeRecord | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(bridgeFile(home), "utf8")) as Partial<BridgeRecord>;
    if (!parsed.pid || !parsed.port || !parsed.token || !parsed.bridgeId) return null;
    return { pid: parsed.pid, port: parsed.port, token: parsed.token, bridgeId: parsed.bridgeId };
  } catch {
    return null;
  }
}

export function pidAlive(pid: number): boolean {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function claimBridge(home: string, record: BridgeRecord): void {
  fs.mkdirSync(home, { recursive: true });
  fs.chmodSync(home, 0o700);
  const file = bridgeFile(home);
  fs.writeFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

export function releaseBridge(home: string, pid = process.pid): void {
  const current = readBridge(home);
  if (current?.pid === pid) fs.rmSync(bridgeFile(home), { force: true });
}

/** The page token outlives bridge restarts (bridge.json does not), so open tabs reconnect without reopening. */
export function tokenFile(home: string): string {
  return path.join(home, "token");
}

export function readToken(home: string): string | undefined {
  try {
    const token = fs.readFileSync(tokenFile(home), "utf8").trim();
    return /^[0-9a-f]{32,}$/.test(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(home: string, token: string): void {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenFile(home), `${token}\n`, { mode: 0o600 });
  fs.chmodSync(tokenFile(home), 0o600);
}
