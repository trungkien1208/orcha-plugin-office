import { catalogFrom, fallbackCatalog, type SkinCatalog } from "@easy-job/shared";
import fs from "node:fs";
import path from "node:path";

let current = fallbackCatalog();

export function getCatalog(): SkinCatalog {
  return current;
}

export function setCatalog(catalog: SkinCatalog): void {
  current = catalog;
}

export function manifestPath(fromDir: string): string {
  return path.resolve(fromDir, "../../web/public/office/manifest.json");
}

export function readCatalog(file: string): SkinCatalog {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      characters?: { cast?: unknown; skins?: Record<string, unknown> };
    };
    const cast = Array.isArray(raw.characters?.cast)
      ? raw.characters.cast.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const skinIds = Object.keys(raw.characters?.skins ?? {});
    if (!cast.length && !skinIds.length) return fallbackCatalog();
    return catalogFrom(cast, skinIds);
  } catch {
    return fallbackCatalog();
  }
}

export function watchCatalog(file: string, onChange: (catalog: SkinCatalog) => void): () => void {
  if (!fs.existsSync(file)) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watcher = fs.watch(file, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onChange(readCatalog(file)), 100);
  });
  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
