import { useEffect, useRef, useState } from "react";
import type { Theme } from "./data";
import { InstallDialog } from "./Install";
import { Office } from "./Office";
import { Pitch } from "./Pitch";
import { Reception } from "./Reception";
import { useEntrance } from "./useEntrance";

/** Reception first, then the office with the pitch below it. `#office` skips reception. */
export function Landing() {
  const [theme, setTheme] = useState<Theme>("office");
  const [calm, setCalm] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [installing, setInstalling] = useState(false);
  const pitch = useRef<HTMLElement>(null);
  const entrance = useEntrance(calm);
  const atReception = !entrance.entered || entrance.phase === "revealing";
  const world = useRef<HTMLDivElement>(null);

  // The office width depends on the viewport height too; the pitch lines up with whatever it ends up as.
  useEffect(() => {
    const root = world.current;
    const office = root?.querySelector(".workplace");
    if (!root || !office) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) root.style.setProperty("--office-width", `${entry.contentBoxSize[0]?.inlineSize ?? 0}px`);
    });
    observer.observe(office);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={world} className="landing-world" data-theme={theme} data-calm={calm ? "true" : "false"}>
      <Office
        entered={entrance.entered}
        nativeReady={entrance.nativeReady}
        inert={atReception}
        theme={theme}
        calm={calm}
        onTheme={setTheme}
        onCalm={setCalm}
        onLeave={entrance.leave}
        onInstall={() => setInstalling(true)}
        onAbout={() => pitch.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth" })}
      />
      <Pitch ref={pitch} inert={atReception} calm={calm} theme={theme} />
      {atReception && (
        <Reception
          phase={entrance.phase}
          opening={entrance.opening}
          progress={entrance.progress}
          loadError={entrance.loadError}
          flight={entrance.flight}
          door={entrance.door}
          calm={calm}
          onEnter={() => void entrance.enter()}
        />
      )}
      <InstallDialog open={installing} onClose={() => setInstalling(false)} />
    </div>
  );
}
