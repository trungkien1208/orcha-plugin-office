import { useEffect, useState } from "react";
import { Intro } from "./Intro";
import { Manual } from "./Manual";

const SKIP_HASH = "#play";

/** Title screen first, then the manual. `#play` (or any section link) skips the title screen. */
export function Landing() {
  // Follows the system "reduce motion" setting; there is no switch on the page.
  const [calm, setCalm] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [atTitle, setAtTitle] = useState(() => !location.hash);
  // The product demo is hidden under the title screen: build it once the entrance has settled
  // (or straight away when the title is skipped), so its load work never competes with the animation.
  const [demo, setDemo] = useState(() => !!location.hash);
  useEffect(() => {
    if (demo) return;
    const id = setTimeout(() => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => setDemo(true), { timeout: 800 });
      else setDemo(true);
    }, 2400);
    return () => clearTimeout(id);
  }, [demo]);

  function start() {
    setDemo(true);
    setAtTitle(false);
    if (!location.hash) history.replaceState(null, "", SKIP_HASH);
    scrollTo(0, 0);
  }

  function title() {
    history.replaceState(null, "", location.pathname + location.search);
    setAtTitle(true);
  }

  return (
    <div className="landing" data-calm={calm ? "true" : "false"}>
      <Manual calm={calm} inert={atTitle} demo={demo} onTitle={title} />
      {atTitle && <Intro calm={calm} onStart={start} />}
    </div>
  );
}
