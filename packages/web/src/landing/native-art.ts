import { officeAssetUrl } from "../floor/asset-url";
import type { ArtBank, Manifest } from "../floor/manifest";
let pending: Promise<ArtBank> | undefined;
/** Reuse the Floor's native art; deliberately exclude landing illustrations and gate art. */
export function preloadNativeFloor(progress: (value: number) => void = () => undefined): Promise<ArtBank> {
  if (pending) return pending;
  const load = async () => {
    const response = await fetch(officeAssetUrl("office/manifest.json"));
    if (!response.ok) throw new Error("Office manifest unavailable");
    const manifest = (await response.json()) as Manifest;
    const paths = (value: unknown): string[] =>
      typeof value === "string" && value.endsWith(".png")
        ? [value]
        : value && typeof value === "object"
          ? Object.values(value).flatMap(paths)
          : [];
    const queue = [
      ...new Set(
        paths([
          manifest.characters,
          manifest.tiles,
          manifest.objects,
          manifest.ui,
          manifest.backgrounds,
          ...Object.values(manifest.themes ?? {}).map((theme) => ({
            tiles: theme.tiles,
            objects: theme.objects,
            characters: theme.characters,
            ui: theme.ui,
            backgrounds: theme.backgrounds,
          })),
        ]),
      ),
    ];
    const total = queue.length,
      images = new Map<string, HTMLImageElement>();
    let complete = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (let path = queue.shift(); path; path = queue.shift()) {
          const image = new Image();
          image.src = officeAssetUrl(path);
          await image.decode();
          images.set(path, image);
          progress(Math.round((++complete / total) * 100));
        }
      }),
    );
    return { manifest, images, missing: [] };
  };
  pending = load().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
