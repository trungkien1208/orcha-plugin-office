import { type CSSProperties, useEffect, useState } from "react";
import { FRAME, framesOf, tintedSheet } from "./sprites";

type Props = { skin: string; color: string; animation?: string; scale?: number; className?: string; style?: CSSProperties };

/**
 * One character as a CSS sprite. The row comes from the manifest; frames in that row play with steps().
 * Calm and reduced motion stop on the first frame (see `.walker` in landing.css).
 */
export function Walker({ skin, color, animation = "walkLeft", scale = 2, className = "", style }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    tintedSheet(skin, color)
      .then((value) => live && setUrl(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [skin, color]);

  const frames = framesOf(animation);
  const first = frames[0] ?? 0;
  const row = Math.floor(first / FRAME.columns);
  const column = first % FRAME.columns;
  const w = FRAME.width * scale;
  const h = FRAME.height * scale;
  return (
    <span
      className={`walker ${className}`}
      aria-hidden="true"
      data-ready={url ? "true" : "false"}
      style={
        {
          ...style,
          width: w,
          height: h,
          backgroundImage: url ? `url(${url})` : undefined,
          backgroundSize: `${FRAME.columns * w}px ${FRAME.rows * h}px`,
          "--sprite-from": `${-column * w}px`,
          "--sprite-to": `${-(column + frames.length) * w}px`,
          "--sprite-y": `${-row * h}px`,
          "--sprite-steps": frames.length || 1,
        } as CSSProperties
      }
    />
  );
}
