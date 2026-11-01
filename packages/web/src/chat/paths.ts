const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const UPLOAD = /@?(\/\S*?\/uploads\/(\S+?\.(?:png|jpe?g|gif|webp)))(?=\s|$)/gi;

export const isImagePath = (at: string) => IMAGE.test(at);

/** `src/a.ts`, `./docs/`, `/abs/x.png`, `file.tsx:12`: something worth opening. Not URLs, versions or sentences. */
export function looksLikePath(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 240 || /\s/.test(value) || /^[a-z]+:\/\//i.test(value)) return false;
  if (!/^[~./@\w-][\w@.\-/~]*(:\d+(:\d+)?)?$/.test(value)) return false;
  const bare = value.replace(/:\d+(:\d+)?$/, "");
  return bare.includes("/") || /^\.[\w-]+$/.test(bare) || /\.[a-z][a-z0-9]{0,7}$/i.test(bare);
}

/** A path from the chat made relative to the Agent's folder, or null when it points outside it. */
export function repoRelative(raw: string, root?: string): string | null {
  let value = raw.trim().replace(/^@/, "").replace(/:\d+(:\d+)?$/, "");
  if (value.startsWith("/")) {
    if (!root) return null;
    const base = root.replace(/\/+$/, "");
    if (value === base) return "";
    if (!value.startsWith(`${base}/`)) return null;
    value = value.slice(base.length + 1);
  }
  value = value.replace(/^(\.\/)+/, "");
  if (value.startsWith("~") || value.split("/").includes("..")) return null;
  return value;
}

/** Images the composer uploaded, as `@/…/uploads/<id>` in a prompt: their upload ids and the text without them. */
export function uploadImages(text: string): { ids: string[]; rest: string } {
  const ids: string[] = [];
  const rest = text.replace(UPLOAD, (_, _full: string, id: string) => { ids.push(id); return ""; }).replace(/\n{3,}/g, "\n\n").trim();
  return { ids, rest };
}

/** The upload id of a single upload path, if that is what this is. */
export function uploadId(text: string): string | null {
  const found = uploadImages(text.trim());
  return found.ids.length === 1 && !found.rest ? (found.ids[0] ?? null) : null;
}

/**
 * Resolve a path from the chat against the Agent's file list: an exact file or folder, or a bare name / tail that
 * matches exactly one file. Null means "do not link it" (branch names, other repos, missing files).
 */
export function pathResolver(files: string[], root?: string): (raw: string) => string | null {
  const fileSet = new Set(files);
  const dirs = new Set<string>([""]);
  const byName = new Map<string, string[]>();
  for (const file of files) {
    const parts = file.split("/");
    for (let index = 1; index < parts.length; index += 1) dirs.add(parts.slice(0, index).join("/"));
    const name = parts.at(-1) ?? file;
    byName.set(name, [...(byName.get(name) ?? []), file]);
  }
  return (raw) => {
    if (!looksLikePath(raw)) return null;
    const relative = repoRelative(raw, root);
    if (relative === null) return null;
    const at = relative.replace(/\/+$/, "");
    if (fileSet.has(at) || (at && dirs.has(at))) return at;
    const candidates = (byName.get(at.split("/").pop() ?? at) ?? []).filter((file) => file === at || file.endsWith(`/${at}`));
    return candidates.length === 1 ? (candidates[0] ?? null) : null;
  };
}
