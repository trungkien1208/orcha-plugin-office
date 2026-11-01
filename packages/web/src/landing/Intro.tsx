import { type CSSProperties, useEffect, useRef, useState } from "react";
import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART } from "./art.generated";
import { PARADE } from "./data";
import { Walker } from "./Walker";

const TAGLINE = "a little office for your AI agents";
const LETTERS = [..."easy job"].map((letter, i) => ({ id: `l${i}`, letter, i }));
const CROWD = [0, 1].flatMap((loop) => PARADE.map((c) => ({ ...c, id: `${loop}-${c.skin}` })));

/** Title screen. Any key, a click or Press start leaves it; the page underneath is already there. */
export function Intro({ calm, onStart }: { calm: boolean; onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState(calm ? TAGLINE.length : 0);
  // Start the entrance once fonts are in and the first frames are painted, so load work never lands mid-drop.
  const [ready, setReady] = useState(false);
  const gone = useRef(false);

  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => live && setReady(true))),
    );
    return () => {
      live = false;
    };
  }, []);

  function leave() {
    if (gone.current) return;
    gone.current = true;
    if (calm) return onStart();
    setLeaving(true);
    setTimeout(onStart, 520);
  }
  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Tab") return;
      event.preventDefault();
      leaveRef.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (calm) return setTyped(TAGLINE.length);
    if (!ready || typed >= TAGLINE.length) return;
    const id = setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 1400 : 40);
    return () => clearTimeout(id);
  }, [typed, calm, ready]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on window above.
    <section
      className={`intro${leaving ? " is-leaving" : ""}`}
      data-ready={ready || undefined}
      aria-label="Easy Job title screen"
      onClick={leave}
    >
      <div className="intro-stars" aria-hidden="true" />
      <header className="intro-hud">
        <span>
          1UP <b>BOSS</b>
        </span>
        <span>
          HI-SCORE <b>12 AGENTS</b>
        </span>
        <span>
          CREDIT <b>00</b>
        </span>
      </header>

      <div className="intro-title">
        <img className="intro-logo" src={officeAssetUrl(LANDING_ART.logo224)} width={112} height={112} alt="" />
        <h1 className="intro-word" aria-label="Easy Job">
          {LETTERS.map(({ id, letter, i }) => (
            <span key={id} style={{ "--i": i } as CSSProperties} aria-hidden="true">
              {letter === " " ? " " : letter}
            </span>
          ))}
        </h1>
        <p className="intro-pay">high pay.</p>
        <p className="intro-tagline">
          {TAGLINE.slice(0, typed)}
          <span className="intro-caret" aria-hidden="true" />
        </p>
        <button type="button" className="intro-start" onClick={leave}>
          Press start
        </button>
        <p className="intro-hint">or press any key</p>
      </div>

      <div className="intro-floor" aria-hidden="true">
        <div className="intro-parade">
          {CROWD.map((c) => (
            <Walker key={c.id} skin={c.skin} color={c.color} scale={2} />
          ))}
        </div>
      </div>
      <p className="intro-legal">© Easy Job · a local client for Orcha</p>
    </section>
  );
}
