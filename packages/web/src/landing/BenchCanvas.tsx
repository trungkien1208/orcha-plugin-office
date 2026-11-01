import { useEffect, useRef } from "react";
import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART as art } from "./art.generated";
import { tintedSheet } from "./sprites";

export type DeskStatus = "working" | "blocked" | "done";

const SCREEN: Record<DeskStatus, string> = { working: "#8eabcc", blocked: "#e8b45a", done: "#85a283" };
const ANIMATION: Record<DeskStatus, string> = { working: "typeUp", blocked: "handUp", done: "relaxUp" };
/** Native 1x size of a four-Desk Bench with its tag; the CSS scales it up with nearest-neighbour. */
export const BENCH_SIZE = { width: 224, height: 112 };
/** Where Desk `i` sits on the canvas, for click targets laid over it. */
export const deskX = (i: number) => 48 + i * 32;

function load(src: string) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

type Props = { skins: string[]; statuses: DeskStatus[]; color: string; still: boolean; className?: string };

/** One Bench of four Agents drawn from the native sheets, props and status marker. */
export function BenchCanvas({ skins, statuses, color, still, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ statuses, still });
  latest.current = { statuses, still };

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let cancelled = false;
    let frame = 0;
    const propPaths = ["benchL", "benchM", "benchR", "monitor", "chairBack", "benchTag"].map((k) => art.props[k] ?? "");
    const markerPath = art.effects.markerNeeds ?? "";
    (async () => {
      const sheets = await Promise.all(skins.map((s) => tintedSheet(s, color).then(load)));
      const props = await Promise.all(propPaths.map((p) => load(officeAssetUrl(p))));
      const marker = await load(officeAssetUrl(markerPath));
      if (cancelled) return;
      const [benchL, benchM, benchR, monitor, chairBack, benchTag] = props;
      const { width: w, height: h, columns } = art.frame;
      const screen = art.monitorScreen;
      const markerFrame = art.effectFrames.markerNeeds;
      const start = performance.now();
      let drawn = "";
      const draw = (now: number) => {
        if (cancelled) return;
        frame = requestAnimationFrame(draw);
        const { statuses: current, still: calm } = latest.current;
        const time = calm ? 0 : now - start;
        const tick = Math.floor(time / 230);
        // The marker bobs every frame; otherwise redraw only when a frame or a status changes.
        const key = `${tick}|${current.join()}`;
        if (key === drawn && (calm || !current.includes("blocked"))) return;
        drawn = key;
        ctx.clearRect(0, 0, element.width, element.height);
        ctx.imageSmoothingEnabled = false;
        if (benchL) ctx.drawImage(benchL, 16, 28);
        if (benchR) ctx.drawImage(benchR, 176, 28);
        sheets.forEach((sheet, i) => {
          const x = deskX(i);
          const status = current[i] ?? "working";
          if (benchM) ctx.drawImage(benchM, x, 28);
          ctx.fillStyle = SCREEN[status];
          ctx.fillRect(x + screen.x, 24 + screen.y, screen.width, screen.height);
          if (monitor) ctx.drawImage(monitor, x, 24);
          const frames = art.animations[ANIMATION[status]] ?? [0];
          const index = frames[tick % frames.length] ?? 0;
          ctx.drawImage(sheet, (index % columns) * w, Math.floor(index / columns) * h, w, h, x - 8, 24, w, h);
          if (chairBack) ctx.drawImage(chairBack, x, 68);
          if (status === "blocked" && markerFrame) {
            const bob = calm ? 0 : Math.abs(Math.sin(time / 250)) * 4;
            ctx.drawImage(marker, 0, 0, markerFrame.frame.width, markerFrame.frame.height, x + 13, 4 - bob, markerFrame.frame.width, markerFrame.frame.height);
          }
        });
        if (benchTag) ctx.drawImage(benchTag, 76, 96);
        ctx.fillStyle = color;
        ctx.fillRect(80, 102, 54, 7);
        element.dataset.ready = "true";
      };
      draw(performance.now());
    })().catch(() => {
      if (element) element.dataset.ready = "error";
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [skins, color]);

  return (
    <canvas
      ref={canvas}
      className={className}
      width={BENCH_SIZE.width}
      height={BENCH_SIZE.height}
      role="img"
      aria-label="A Bench of four Agents"
    />
  );
}
