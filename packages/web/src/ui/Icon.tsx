import { PixelIcon } from "../floor/PixelIcon";

/** Semantic UI names, drawn in the mint/peach/lavender native pixel family. */
export function Icon({ name, label, className }: { name: string; label?: string; className?: string }) {
  return <PixelIcon name={name} label={label} className={`icon office-icon ${className ?? ""}`} />;
}
