import { officeAssetUrl } from "./asset-url";
export type CharacterArt = { sheet?: string; polo?: string; portrait?: string; portraitPolo?: string };
export type Manifest = {
  characters?: { frame?: { width?: number; height?: number; columns?: number; rows?: number; foot?: number }; bossRows?: number; cast?: string[]; boss?: CharacterArt;
 bouncer?: CharacterArt & { columns?: number; rows?: number }; skins?: Record<string, CharacterArt> };
  tiles?: Record<string, string>;
  objects?: Record<string, string | string[] | Record<string, string>>;
  backgrounds?: Record<string, string>;
  ui?: Record<string, string>;
  /** Per-theme overrides, same group/key as the defaults (themes.office.tiles.floor). */
  themes?: Record<string, Record<string, Record<string, unknown>>>;
  layout?: {
    monitor?: { screen?: { x: number; y: number; width: number; height: number } }; sleep?: { frame?: { width: number; height: number } };
    animations?: Record<string, { frame?: { width: number; height: number } }>;
    hpBar?: Slice & { fill?: { x: number; y: number; width: number; height: number } }; namePlate?: Slice;
    teamSignHanging?: Slice & { tint?: { x: number; y: number; width: number; height: number } };
  };
};
export type Slice = { left: number; right: number; top: number; bottom: number };
export type ArtBank = { manifest: Manifest; images: Map<string, HTMLImageElement>; missing: string[] };
const cache = new Map<string, Promise<ArtBank>>();
function paths(value: unknown): string[] {
  if (typeof value === "string" && value.endsWith(".png")) return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(paths);
  return [];
}
export function loadArt(url = officeAssetUrl("office/manifest.json")): Promise<ArtBank> {
  const existing = cache.get(url); if (existing) return existing;
  const loading = (async () => {
    let manifest: Manifest = {};
    try { const response = await fetch(url); if (response.ok) manifest = await response.json() as Manifest; } catch { /* per-key placeholders remain */ }
    const images = new Map<string, HTMLImageElement>(), missing: string[] = [];
    const pendingPaths = [...new Set(paths(manifest))];
    const loadImage = (path: string) => new Promise<void>((resolve) => {
      const artRoot = new URL("../", new URL(url, document.baseURI));
      const target = new URL(path.replace(/^\/+/, ""), artRoot);
      if (target.origin !== window.location.origin) { missing.push(path); resolve(); return; }
      const img = new Image(); img.onload = () => { images.set(path, img); resolve(); }; img.onerror = () => { missing.push(path); resolve(); }; img.src = target.href;
    });
    // Bound requests so the standalone demo also works on simple static servers.
    await Promise.all(Array.from({ length: 8 }, async () => {
      for (let path = pendingPaths.shift(); path; path = pendingPaths.shift()) await loadImage(path);
    }));
    return { manifest, images, missing };
  })(); cache.set(url, loading); return loading;
}
export function artPath(bank: ArtBank, group: "objects" | "tiles" | "ui" | "backgrounds", key: string, theme?: string): string | undefined {
  const themed = theme ? bank.manifest.themes?.[theme]?.[group]?.[key] : undefined;
  if (typeof themed === "string" && bank.images.has(themed)) return themed;
  const value = bank.manifest[group]?.[key]; return typeof value === "string" ? value : undefined;
}
/** A themed character sheet (themes.office.characters.bouncer), as a path or { sheet }. */
export function themedSheet(bank: ArtBank, theme: string | undefined, key: string): string | undefined {
  const value = theme ? bank.manifest.themes?.[theme]?.characters?.[key] : undefined;
  const sheet = typeof value === "string" ? value : (value as { sheet?: string } | undefined)?.sheet;
  return sheet && bank.images.has(sheet) ? sheet : undefined;
}
export function composite(base: HTMLImageElement, mask: HTMLImageElement | undefined, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = base.width; canvas.height = base.height;
  const ctx = canvas.getContext("2d"); if (!ctx) return canvas; ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0);
  if (mask) {
    const layer = document.createElement("canvas"); layer.width = base.width; layer.height = base.height; const g = layer.getContext("2d");
    if (g) { g.drawImage(mask, 0, 0); g.globalCompositeOperation = "multiply"; g.fillStyle = color; g.fillRect(0, 0, layer.width, layer.height); g.globalCompositeOperation = "destination-in"; g.drawImage(mask, 0, 0); ctx.drawImage(layer, 0, 0); }
  }
  return canvas;
}
