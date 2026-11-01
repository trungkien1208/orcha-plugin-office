import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { token } from "../api.ts";
import { useOffice } from "../useOffice.ts";
import { loadArt } from "../floor/manifest.ts";

export type EntryState = "connecting" | "approved" | "denied" | "down";

export function EntryGate({
  state,
  children,
  onEntered,
}: {
  state: EntryState;
  children?: ReactNode;
  onEntered?: () => void;
}) {
  const { theme, calm } = useOffice();
  const [ready, setReady] = useState(false);
  const reduced = calm || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = theme === "office" ? "/office/theme-office/gate/lobby-day.png" : "/office/gate/gate-night.png";

  useEffect(() => {
    let live = true;
    // Warm the Floor while the full-screen gate covers its first render.
    void Promise.all([loadArt(), document.fonts.ready]).then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "approved" || !ready || !onEntered) return;
    const timer = setTimeout(onEntered, reduced ? 100 : 700);
    return () => clearTimeout(timer);
  }, [state, ready, reduced, onEntered]);

  const title = {
    connecting: "Connecting…",
    approved: "Welcome to Easy Job",
    denied: "Open Easy Job from the terminal",
    down: "Orcha isn't running",
  }[state];

  return (
    <main
      className={`entry-gate entry-${state}`}
      aria-label="Welcome to Easy Job"
      aria-busy={state === "connecting" || (state === "approved" && !ready)}
    >
      <div className="entry-scene" style={{ backgroundImage: `url(${scene})` }} />
      <section className="entry-content">
        <h1>{title}</h1>
        <div className="entry-badge">
          <img
            className="entry-portrait"
            src={
              theme === "office"
                ? "/office/theme-office/characters/boss-portrait.png"
                : "/office/characters/boss-portrait.png"
            }
            alt="Boss"
          />
          <span>{(token() ?? "").slice(0, 6) || "VISITOR"}</span>
          {state === "approved" || state === "denied" ? (
            <img
              className="entry-stamp"
              src={`/office/gate/stamp-${state === "approved" ? "approved" : "denied"}.png`}
              alt={state}
            />
          ) : null}
        </div>
        {state === "connecting" ? (
          <div className="entry-progress" role="status" aria-label="Connecting">
            <i />
          </div>
        ) : null}
        {state === "denied" ? (
          <p>
            Open Easy Job from the terminal: <code>easy-job open</code>
          </p>
        ) : null}
        {state === "down" ? (
          <img className="entry-offline" src="/office/ui/orcha-down.png" alt="Offline workstation" />
        ) : null}
        {children}
      </section>
    </main>
  );
}
