import { officeAssetUrl } from "./asset-url";
import { PIXEL_COLUMNS, PIXEL_ICON_INDEX, PIXEL_SHEET } from "./pixel-icons.generated";

/** Native 16px Party Agent style artwork; shared by the isolated Floor and app shell. */
export function PixelIcon({
  name,
  label,
  className = "",
  size = 16,
}: {
  name: string;
  label?: string;
  className?: string;
  size?: 16 | 32;
}) {
  const index = PIXEL_ICON_INDEX[name] ?? PIXEL_ICON_INDEX.help ?? 0;
  return (
    <span
      className={`pixel-icon ${className}`}
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        verticalAlign: "-3px",
        imageRendering: "pixelated",
        backgroundImage: `url(${officeAssetUrl(PIXEL_SHEET)})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${PIXEL_COLUMNS * size}px auto`,
        backgroundPosition: `-${(index % PIXEL_COLUMNS) * size}px -${Math.floor(index / PIXEL_COLUMNS) * size}px`,
      }}
    />
  );
}
