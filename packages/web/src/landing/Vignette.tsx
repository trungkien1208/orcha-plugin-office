import { useEffect, useRef, useState } from "react";
import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART as art } from "./art.generated";
import type { Theme } from "./data";

export type Scene = "bench" | "needs" | "seen" | "boss" | "hr";

/** Small native-sheet scenes. The only animation loop exists while this canvas is visible and active. */
export function Vignette({ scene, calm, theme }: { scene: Scene; calm: boolean; theme: Theme }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [acted, setActed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const still = calm || reduced;
  const running = visible && !hidden && !still;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    observer.observe(element);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx || !visible) return;
    let cancelled = false;
    let frame = 0;
    const images = new Map<string, HTMLImageElement>();
    const skins = scene === "bench" ? ["headset", "red-cap", "robot", "tabby"] : scene === "hr" ? ["red-cap"] : ["headset"];
    const paths = new Set([
      ...skins.flatMap(key => { const skin = art.sheets[key]; return skin ? [skin.sheet, ...(skin.polo ? [skin.polo] : [])] : []; }),
      ...(scene === "boss" ? [art.boss[theme]] : []),
      ...(scene === "hr" ? [art.bouncer[theme]] : []),
      ...Object.values(art.props), ...Object.values(art.effects),
    ]);
    async function load() {
      await Promise.all([...paths].map(async path => {
        const image = new Image();
        image.src = officeAssetUrl(path);
        await image.decode();
        images.set(path, image);
      }));
      if (cancelled) return;
      const started = performance.now();
      const w = art.frame.width, h = art.frame.height, cols = art.frame.columns;
      const uniforms = new Map<string, HTMLCanvasElement>();
      function sprite(path: string, index: number, x: number, y: number) {
        const image = images.get(path);
        if (image) ctx?.drawImage(image, (index % cols) * w, Math.floor(index / cols) * h, w, h, x, y, w, h);
      }
      function prop(key: string, x: number, y: number) {
        const path = art.props[key] ?? art.effects[key];
        const image = path && images.get(path);
        if (image) ctx?.drawImage(image, x, y);
      }
      function monitor(x: number, y: number, status = "#8eabcc") {
        const screen = art.monitorScreen;
        if (ctx) { ctx.fillStyle = status; ctx.fillRect(x + screen.x, y + screen.y, screen.width, screen.height); }
        prop("monitor", x, y);
      }
      function worker(skin: string, animation: string, tick: number, x: number, y: number) {
        const sheet = art.sheets[skin];
        const frames = art.animations[animation];
        if (!sheet || !frames?.length || !ctx) return;
        const index = frames[tick % frames.length] ?? frames[0] ?? 0;
        sprite(sheet.sheet, index, x, y);
        if (sheet.polo) {
          let tinted = uniforms.get(skin);
          const mask = images.get(sheet.polo);
          if (!tinted && mask) {
            tinted = document.createElement("canvas");
            tinted.width = mask.width; tinted.height = mask.height;
            const tint = tinted.getContext("2d");
            if (tint) { tint.drawImage(mask, 0, 0); tint.globalCompositeOperation = "source-in"; tint.fillStyle = "#70a597"; tint.fillRect(0, 0, mask.width, mask.height); }
            uniforms.set(skin, tinted);
          }
          if (tinted) ctx.drawImage(tinted, (index % cols)*w, Math.floor(index/cols)*h, w,h,x,y,w,h);
        }
      }
      function draw(now: number) {
        if (cancelled || !ctx || !element) return;
        const time = running ? now - started : 0;
        const tick = Math.floor(time / 230);
        ctx.clearRect(0, 0, element.width, element.height);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = theme === "office" ? "#e4d7b8" : "#344336";
        ctx.fillRect(8, 109, 304, 1);
        if (scene === "bench") {
          prop("benchL", 64, 28);
          for (const [i, skin] of ["headset", "red-cap", "robot", "tabby"].entries()) {
            const x = 96 + i * 32;
            prop("benchM", x, 28);
            monitor(x, 24);
            worker(skin, "typeUp", tick, x - 8, 24);
            prop("chairBack", x, 68);
          }
          prop("benchR", 224, 28);
          prop("benchTag", 124, 96);
          ctx.fillStyle = "#70a597"; ctx.fillRect(128, 102, 54, 7);
          ctx.fillStyle = "#18221d"; ctx.font = "8px monospace"; ctx.fillText("API", 146, 108);
        } else if (scene === "hr") {
          const x = still ? 132 : 260 - (time / 22) % 240;
          const frames = art.bouncer.animations.carryLeft ?? [];
          const carried = art.animations.carriedDown ?? [];
          sprite(art.bouncer[theme], frames[tick % frames.length] ?? 0, x - 31, 37);
          sprite(art.sheets["red-cap"]?.sheet ?? "", carried[tick % carried.length] ?? 0, x, 18);
          ctx.save(); ctx.translate((x + 31) * 2 + w, 0); ctx.scale(-1, 1);
          sprite(art.bouncer[theme], frames[tick % frames.length] ?? 0, x + 31, 37); ctx.restore();
        } else if (scene === "boss") {
          const frames = art.boss.animations.walkDown ?? [];
          sprite(art.boss[theme], frames[tick % frames.length] ?? 0, 59, 34);
          prop("benchL", 189, 28); prop("benchM", 221, 28); prop("benchR", 253, 28); monitor(221, 24);
          worker("headset", "typeUp", tick, 213, 24); prop("chairBack", 221, 68);
          if (running) {
            const image = images.get(art.effects.fxPaperPlane ?? "");
            const layout = art.effectFrames.fxPaperPlane;
            if (image && layout) {
              const progress = (time % 2200) / 2200;
              ctx.drawImage(image, 0, 0, layout.frame.width, layout.frame.height, 96 + progress * 125, 50 - Math.sin(progress * Math.PI) * 26, layout.frame.width, layout.frame.height);
            }
          }
        } else {
          prop("benchL", 104, 28); prop("benchM", 136, 28); prop("benchR", 168, 28); monitor(136, 24, scene === "seen" && !acted ? "#85a283" : acted && scene === "seen" ? "#3b4560" : "#8eabcc");
          worker("headset", acted ? (scene === "needs" ? "typeUp" : "idleDown") : scene === "needs" ? "handUp" : "relaxUp", tick, 128, 24);
          prop("chairBack", 136, 68);
          if (scene === "needs" && !acted) {
            const image = images.get(art.effects.markerNeeds ?? "");
            const marker = art.effectFrames.markerNeeds;
            if (image && marker) ctx.drawImage(image, 0, 0, marker.frame.width, marker.frame.height, 149, 7 - (running ? Math.abs(Math.sin(time / 250)) * 5 : 0), marker.frame.width, marker.frame.height);
          }
          if (acted && !still) prop(scene === "needs" ? "stampUrgent" : "stampDone", 220, 68);
        }
        element.dataset.frame = `${tick}`;
        element.dataset.ready = "true";
        if (running) frame = requestAnimationFrame(draw);
      }
      draw(performance.now());
    }
    void load().catch(() => { if (element) element.dataset.ready = "error"; });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [scene, acted, theme, visible, running, still]);

  const interactive = scene === "needs" || scene === "seen";
  const label = scene === "needs" ? (acted ? "Answer recorded; Agent is Working" : "Answer the raised hand") : (acted ? "Seen; Agent is idle" : "Mark this finish Seen");
  return (
    <div className="vignette" data-scene={scene} data-still={still} data-running={running}>
      <canvas ref={canvas} width={320} height={120} role="img" aria-label={`${scene} office scene`} />
      {interactive && <button className="vignette-action" type="button" aria-pressed={acted} onMouseEnter={() => { if (scene === "needs" && !still) setActed(true); }} onClick={() => setActed(true)}>{label}</button>}
    </div>
  );
}
