import { useRef, useState } from "react";
import { INSTALL_COMMANDS, INSTALL_STEPS, ORCHA_URL } from "./data";

/** Install commands. Copy "inserts a coin"; a blocked clipboard falls back to selecting the text. */
export function InsertCoin() {
  const [credits, setCredits] = useState(0);
  const [message, setMessage] = useState("");
  const code = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMANDS);
      setCredits((n) => Math.min(n + 1, 99));
      setMessage("Copied. Paste into your terminal.");
    } catch {
      const selection = getSelection();
      if (code.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(code.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setMessage("Commands selected. Press Ctrl+C or ⌘C to copy.");
    }
  }

  return (
    <div className="coin">
      <div className="coin-screen">
        <div className="coin-hud">
          <span>PLAYER 1</span>
          <span>
            CREDIT <b data-testid="credits">{String(credits).padStart(2, "0")}</b>
          </span>
        </div>
        <code ref={code} className="coin-steps">
          {INSTALL_STEPS.map((step) => (
            <span key={step.cmd} className="coin-step">
              <span className="coin-line" title={step.cmd}>
                {step.cmd}
              </span>
              <span className="coin-note" aria-hidden="true">
                {step.note}
              </span>
            </span>
          ))}
        </code>
      </div>
      <div className="coin-panel">
        <button type="button" className="coin-slot" aria-label="Copy installation commands" onClick={() => void copy()}>
          <span className="coin-slot-mouth" aria-hidden="true" />
          {credits ? "Copied · insert another" : "Insert coin · copy"}
        </button>
        <p className="coin-feedback" role="status">
          {message}
        </p>
        <p className="coin-needs">
          Already have Orcha? Skip the first line. Windows and more:{" "}
          <a href={ORCHA_URL} target="_blank" rel="noreferrer">
            Orcha's README
          </a>
          .
        </p>
      </div>
    </div>
  );
}
