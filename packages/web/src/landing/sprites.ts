import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART as art } from "./art.generated";

const cache = new Map<string, Promise<string>>();

function load(path: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = officeAssetUrl(path);
  return image.decode().then(() => image);
}

/** A character sheet with its polo painted in `color`, as an object URL for CSS sprites. */
export function tintedSheet(skin: string, color: string): Promise<string> {
  const key = `${skin}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sheet = art.sheets[skin];
  if (!sheet) return Promise.reject(new Error(`No sheet for ${skin}`));
  const job = (async () => {
    const [base, polo] = await Promise.all([load(sheet.sheet), sheet.polo ? load(sheet.polo) : null]);
    const canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");
    ctx.drawImage(base, 0, 0);
    if (polo) {
      const tint = document.createElement("canvas");
      tint.width = polo.width;
      tint.height = polo.height;
      const t = tint.getContext("2d");
      if (t) {
        t.drawImage(polo, 0, 0);
        t.globalCompositeOperation = "source-in";
        t.fillStyle = color;
        t.fillRect(0, 0, tint.width, tint.height);
        ctx.drawImage(tint, 0, 0);
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) throw new Error("Could not encode sheet");
    return URL.createObjectURL(blob);
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}

/** Frame numbers of one animation row, read from the manifest (never hard-coded). */
export const framesOf = (animation: string) => art.animations[animation] ?? [];
export const FRAME = art.frame;
