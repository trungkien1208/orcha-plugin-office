import fs from "node:fs";
import path from "node:path";

/** Dev runs are `bun <cli>`. A compiled `easy-job` is the program itself. */
export function commandFor(execPath: string, bunPath: string | null, script: string): string[] {
  const canonical = (file: string) => {
    try { return fs.realpathSync(file); } catch { return path.resolve(file); }
  };
  if (bunPath && canonical(execPath) === canonical(bunPath)) return [execPath, script];
  return [execPath];
}

/**
 * Web build for the bridge.
 * A compiled binary uses `easy-job-web` next to the executable. A source run uses `packages/web/dist`.
 */
export function webDistDir(execPath: string, sourceDir: string): string {
  const beside = path.join(path.dirname(execPath), "easy-job-web");
  if (fs.existsSync(path.join(beside, "index.html"))) return beside;
  return path.resolve(sourceDir, "../../web/dist");
}

/** Art manifest. The copied web build carries `office/`; a source run uses `packages/web/public`. */
export function publicArtDir(execPath: string, sourceDir: string): string {
  const beside = path.join(path.dirname(execPath), "easy-job-web");
  if (fs.existsSync(path.join(beside, "office", "manifest.json"))) return beside;
  return path.resolve(sourceDir, "../../web/public");
}
