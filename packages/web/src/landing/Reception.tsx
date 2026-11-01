import { type CSSProperties, lazy, type RefObject, Suspense, useCallback, useState } from "react";
import { officeAssetUrl } from "../floor/asset-url";
import { PixelIcon } from "../floor/PixelIcon";
import { LANDING_ART } from "./art.generated";
import { BrandLogo, Portrait } from "./parts";
import type { Phase } from "./useEntrance";

const ReceptionDoor = lazy(() => import("./ReceptionDoor"));

type Props = {
  phase: Phase;
  opening: boolean;
  progress: number;
  loadError: boolean;
  flight: CSSProperties;
  door: RefObject<HTMLButtonElement | null>;
  calm: boolean;
  onEnter: () => void;
};

function loadingLabel(phase: Phase, loadError: boolean) {
  if (loadError) return "The office could not load.";
  if (phase === "centering") return "Clocking you in…";
  if (phase === "loading") return "Getting your office ready…";
  return "Welcome in, Boss.";
}

/** The CSS door. It stays as the WebGL fallback; the 3D door draws over it when it can. */
function DoorArt({ opening }: { opening: boolean }) {
  return (
    <>
      <span className="door-wall" aria-hidden="true" />
      <div className="door-transom">
        <span>NO. 01</span>
        <span>THE AGENT OFFICE</span>
        <i />
      </div>
      <div className="door-frame">
        <div className="door-room" />
        <div className="door-hinges" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="glass-door">
          <span className="door-slab-edge" aria-hidden="true" />
          <div className="door-face">
            <span className="door-glazing" aria-hidden="true" />
            <div className="door-lettering">
              <img className="door-brand-logo" src={officeAssetUrl(LANDING_ART.logo)} width={112} height={112} alt="" />
              <b>easy job</b>
              <span>PROJECTS & AGENTS</span>
            </div>
            <span className={`door-sign${opening ? " sign-open" : ""}`}>
              <svg className="door-cord" viewBox="0 0 100 40" aria-hidden="true">
                <path d="M16 40 50 3 84 40" />
                <circle cx="50" cy="3" r="1.4" />
              </svg>
              <span>CLOSED</span>
              <span>OPEN</span>
            </span>
            <span className="door-pull" aria-hidden="true">
              <i />
              <i />
            </span>
            <div className="door-lower-panel">
              <span>LOCAL OFFICE</span>
              <span>EST. TODAY</span>
            </div>
            <span className="door-kick" aria-hidden="true" />
          </div>
        </div>
        <span className="door-threshold" aria-hidden="true" />
      </div>
      <span className="door-mat">RECEPTION</span>
    </>
  );
}

export function Reception({ phase, opening, progress, loadError, flight, door, calm, onEnter }: Props) {
  const [doorReady, setDoorReady] = useState(false);
  const doorLoaded = useCallback(() => setDoorReady(true), []);

  return (
    <section
      data-phase={phase}
      className={`entry-screen${opening ? " is-entering" : ""}`}
      aria-label="Easy Job reception"
    >
      <Suspense fallback={null}>
        <ReceptionDoor target={door} phase={phase} calm={calm} onReady={doorLoaded} />
      </Suspense>
      <header className="entry-header">
        <BrandLogo />
        <span>Orcha Projects · Local office</span>
      </header>
      <div className="entry-layout">
        <button
          ref={door}
          type="button"
          onClick={onEnter}
          aria-label="Open the office door"
          disabled={opening}
          className="door-illustration"
          data-rendered={doorReady ? "true" : "false"}
          style={opening ? flight : undefined}
        >
          <DoorArt opening={opening} />
        </button>
        <div className="entry-copy">
          <h1>Report to<br />the Floor</h1>
          <p className="entry-description">Your Orcha Projects have a Bench here.<br />Clock in as the Boss to try the sample office.</p>
          <div className="staff-pass">
            <div className="pass-heading">
              <span>STAFF PASS</span>
              <span>Nº 001</span>
            </div>
            <div className="pass-person">
              <Portrait boss />
              <div>
                <strong>You</strong>
                <span>THE BOSS</span>
              </div>
              <PixelIcon name="crown" size={32} />
            </div>
            <div className="pass-bottom">
              <button type="button" aria-label="Clock in" onClick={onEnter} disabled={opening}>
                <span>
                  <strong>Clock in</strong>
                  <small>Open your office</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <span className="enter-hint">Click to enter · No account needed</span>
            </div>
            {opening && <span className="clock-stamp">ON SHIFT</span>}
          </div>
          <small>This reception opens a demo. Setup stays on your machine.</small>
        </div>
      </div>
      <footer className="entry-footer">
        <span>Easy Job is a local client for Orcha.</span>
      </footer>
      {opening && (
        <div className="door-loading" role="status">
          <span>{loadingLabel(phase, loadError)}</span>
          <progress value={progress} max={100} aria-label="Office assets loaded" />
          {loadError && (
            <button type="button" onClick={onEnter}>
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
