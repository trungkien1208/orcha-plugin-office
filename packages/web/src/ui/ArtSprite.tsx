import type { CSSProperties } from "react";
export function ArtSprite({
  name,
  frame = 0,
  width = 16,
  height = 16,
  columns = 1,
}: {
  name: string;
  frame?: number;
  width?: number;
  height?: number;
  columns?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="art-sprite"
      style={{
        width,
        height,
        backgroundImage: `url(/office/ui/${name}.png)`,
        backgroundPosition: `-${(frame % columns) * width}px -${Math.floor(frame / columns) * height}px`,
      }}
    />
  );
}
export function StageArt({ stage }: { stage?: string | null }) {
  const words = ["thinking", "coding", "testing", "reviewing", "finished"];
  const index = words.findIndex((w) => stage?.toLowerCase().includes(w));
  return (
    <span
      title={stage || "Working"}
      className="stage-art"
      style={{ "--stage": Math.max(0, index === 3 ? 2 : index === 4 ? 3 : index) } as CSSProperties}
    />
  );
}
