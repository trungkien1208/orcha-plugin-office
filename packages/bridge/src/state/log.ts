import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP = 3;

export function logFile(home: string): string {
  return path.join(home, "logs", "bridge.log");
}

/** Append one line and rotate at 5 MB, keeping 3 files. Callers must not pass transcript or prompt bodies. */
export function appendLog(home: string, line: string, maxBytes = MAX_BYTES): void {
  const file = logFile(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line.endsWith("\n") ? line : `${line}\n`);
  rotate(file, maxBytes);
}

function rotate(file: string, maxBytes: number): void {
  if (!fs.existsSync(file) || fs.statSync(file).size < maxBytes) return;
  const oldest = `${file}.${KEEP}`;
  if (fs.existsSync(oldest)) fs.rmSync(oldest);
  for (let index = KEEP - 1; index >= 1; index -= 1) {
    const from = `${file}.${index}`;
    if (fs.existsSync(from)) fs.renameSync(from, `${file}.${index + 1}`);
  }
  fs.renameSync(file, `${file}.1`);
}
