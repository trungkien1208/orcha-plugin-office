import { defaultHome } from "./state/local.ts";
import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);

export type SavedUpload = { id: string; path: string };

export function uploadsRoot(home = defaultHome()): string {
  return path.join(home, "uploads");
}

export function saveUpload(input: {
  paneId: string;
  name: string;
  type: string;
  bytes: Uint8Array;
  home?: string;
}): SavedUpload {
  if (!ALLOWED.has(input.type) && !input.type.startsWith("text/")) {
    throw new Error("Only images, PDF and text files can be attached");
  }
  if (input.bytes.byteLength > MAX_BYTES) throw new Error("Attachment is larger than 20MB");
  const root = uploadsRoot(input.home);
  const pane = input.paneId.replaceAll(/[^a-zA-Z0-9:_-]/g, "");
  const safe = path.basename(input.name).replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  const id = `${pane}/${Date.now()}-${safe}`;
  const file = path.resolve(root, id);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error("Bad attachment path");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, input.bytes);
  return { id, path: file };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneUploads(home = defaultHome(), now = Date.now()): void {
  const root = uploadsRoot(home);
  if (!fs.existsSync(root)) return;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) break;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (now - fs.statSync(full).mtimeMs > WEEK_MS) fs.rmSync(full);
    }
  }
}

export function uploadFile(id: string, home?: string): string | null {
  const root = path.resolve(uploadsRoot(home));
  const file = path.resolve(root, id);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}
