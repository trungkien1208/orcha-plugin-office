import { useEffect, useRef } from "react";
import { useOffice } from "../useOffice.ts";
import { composite, loadArt } from "./manifest.ts";
export function FloorPortrait({ skin, color, size = 32, manifestUrl }: { skin: string; color: string; size?: 16 | 32; manifestUrl?: string }) {
  const {theme}=useOffice();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let live = true; void loadArt(manifestUrl).then((bank) => {
    const entry = skin === "boss" ? bank.manifest.characters?.boss : bank.manifest.characters?.skins?.[skin], portrait = skin === "boss" && theme === "office" ? bank.manifest.themes?.office?.characters?.bossPortrait : entry?.portrait, base = typeof portrait === "string" ? bank.images.get(portrait) : undefined, mask = entry?.portraitPolo ? bank.images.get(entry.portraitPolo) : undefined;
    const g = live ? ref.current?.getContext("2d") : null; if (!g) return; g.clearRect(0, 0, 64, 64); g.imageSmoothingEnabled = false;
    if (base) g.drawImage(composite(base, mask, color), 0, 0, 64, 64); else { g.fillStyle = color; g.fillRect(14, 34, 36, 30); g.fillStyle = "#e2b089"; g.fillRect(20, 8, 24, 28); }
  }); return () => { live = false; }; }, [skin, color, manifestUrl, theme]);
  return <canvas ref={ref} width={64} height={64} style={{ width: size, height: size, imageRendering: "pixelated" }} aria-label={`${skin} portrait`} role="img" />;
}
