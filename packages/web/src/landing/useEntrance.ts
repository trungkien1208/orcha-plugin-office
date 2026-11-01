import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { preloadNativeFloor } from "./native-art";

export type Phase = "idle" | "centering" | "loading" | "opening" | "zooming" | "revealing";

const OFFICE_HASH = "#office";

/** Where the door flies to before it opens: centred, scaled, zoomed through its own frame. */
function measureFlight(door: HTMLButtonElement): CSSProperties {
  const rect = door.getBoundingClientRect();
  const portal = door.querySelector(".door-frame")?.getBoundingClientRect();
  const scale = Math.min(0.78, (innerHeight - 160) / rect.height, (innerWidth - 64) / rect.width);
  const centerX = portal ? (portal.left + portal.width / 2 - rect.left) / rect.width : 0.5;
  const centerY = portal ? (portal.top + portal.height / 2 - rect.top) / rect.height : 0.48;
  const zoom =
    Math.max(
      innerWidth / Math.max(1, (portal?.width ?? rect.width) - 52),
      innerHeight / Math.max(1, (portal?.height ?? rect.height) - 36),
    ) * 1.08;
  return {
    "--from-x": `${rect.left}px`,
    "--from-y": `${rect.top}px`,
    "--to-x": `${(innerWidth - rect.width * scale) / 2}px`,
    "--to-y": `${(innerHeight - rect.height * scale - 85) / 2}px`,
    "--door-scale": scale,
    "--zoom-scale": zoom,
    "--portal-x": `${centerX * 100}%`,
    "--portal-y": `${centerY * 100}%`,
    "--viewport-x": `${innerWidth / 2}px`,
    "--viewport-y": `${innerHeight / 2}px`,
    width: rect.width,
    height: rect.height,
  } as CSSProperties;
}

/**
 * Reception → office. Waits for real fonts, code and art before the door opens; a newer
 * run (or leaving) cancels an older one. Calm skips the pauses but still waits for loading.
 */
export function useEntrance(calm: boolean) {
  const [entered, setEntered] = useState(() => location.hash === OFFICE_HASH);
  const [nativeReady, setNativeReady] = useState(() => location.hash === OFFICE_HASH);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [flight, setFlight] = useState<CSSProperties>({});
  const door = useRef<HTMLButtonElement>(null);
  const run = useRef(0);
  const opening = phase !== "idle";

  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  async function enter() {
    if (opening && !loadError) return;
    const id = ++run.current;
    const current = () => id === run.current;
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, calm ? 0 : ms));

    setLoadError(false);
    setProgress(0);
    if (door.current) setFlight(measureFlight(door.current));
    setPhase("centering");
    await pause(750);
    if (!current()) return;

    setPhase("loading");
    try {
      await Promise.all([
        document.fonts.ready,
        import("./NativeFloor"),
        preloadNativeFloor((value) => current() && setProgress(value)),
        pause(550),
      ]);
    } catch {
      if (current()) setLoadError(true);
      return;
    }
    if (!current()) return;
    setProgress(100);
    setNativeReady(true);

    setPhase("opening");
    await pause(1250);
    if (!current()) return;
    setPhase("zooming");
    await pause(1150);
    if (!current()) return;

    setEntered(true);
    setPhase("revealing");
    history.replaceState(null, "", OFFICE_HASH);
    await pause(350);
    if (!current()) return;
    setPhase("idle");
    document.querySelector<HTMLElement>(".native-floor-host")?.focus({ preventScroll: true });
  }

  const leave = useCallback(() => {
    run.current++;
    setPhase("idle");
    setLoadError(false);
    setEntered(false);
    history.replaceState(null, "", location.pathname + location.search);
  }, []);

  return { entered, nativeReady, phase, opening, progress, loadError, flight, door, enter, leave };
}
