import { PixelIcon } from "./PixelIcon.tsx";
import { useState } from "react";
import { ACTION_LABELS, FUN_ACTIONS, WORK_ACTIONS, availableActions } from "./actions.ts";
import type { BossAction, NearAgent } from "./contract.ts";


const HINTS: Partial<Record<BossAction, string>> = { tap: "Open chat", knock: "Nudge: back to work", whip: "Faster! (asks it to hurry up)", bonk: "Stop (interrupt)", megaphone: "Message the whole team" };

const STATUS: Record<string, string> = { blocked: "needs you", working: "working", done: "done", idle: "idle", unknown: "unknown" };

/** The Boss popup: one row of icon buttons; gags hide behind one button; confirms replace the row. */
export function ActionMenu({ near, connected, calm, perform, close }: {
  near: NearAgent;
  connected: boolean;
  calm?: boolean;
  perform: (kind: BossAction, key: string, payload?: Record<string, string>) => Promise<string>;
  close: () => void;
}) {
  const [dialog, setDialog] = useState<"bonk" | "megaphone" | null>(null);
  const [fun, setFun] = useState(false);
  const [hover, setHover] = useState("");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = availableActions(near.status, connected);
  const run = async (kind: BossAction, payload?: Record<string, string>) => {
    const work = (WORK_ACTIONS as readonly string[]).includes(kind);
    if (work) setBusy(true);
    setDialog(null);
    setMessage(await perform(kind, near.key, payload));
    if (work) setBusy(false);
  };
  const icon = (kind: BossAction | "more") => {
    return <PixelIcon name={`action-${kind}`} />;
  };
  const button = (kind: BossAction, work: boolean) => {
    const label = HINTS[kind] ?? ACTION_LABELS[kind];
    return (
      <button type="button" key={kind} className="ej-act" aria-label={label} disabled={!allowed.includes(kind) || (busy && work)}
        onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover("")} onFocus={() => setHover(label)} onBlur={() => setHover("")}
        onClick={() => (kind === "bonk" || kind === "megaphone" ? setDialog(kind) : void run(kind))}>
        {icon(kind)}
      </button>
    );
  };
  const below = near.y < 300;
  return (
    // Near the top edge the popup opens below the Agent so it is never cut off.
    <div role="dialog" aria-label={`Boss actions for ${near.name}`} className={below ? "ej-actions below" : "ej-actions"} style={{ left: `clamp(150px, ${near.x}px, calc(100% - 150px))`, top: below ? near.y + 18 : near.y - 82 }}
      onKeyDown={(event) => { if (event.key === "Escape") { if (dialog) setDialog(null); else close(); } }}>
      <div className="ej-actions-heading">
        <strong>{near.name}</strong>
        <span className={`ej-state ${near.status}`}>{STATUS[near.status] ?? near.status}</span>
      </div>
      {dialog === "bonk" ? (
        <div className="ej-confirm" role="alertdialog" aria-label={`Stop ${near.name}?`}>
          <span>Stop {near.name}?</span>
          <button type="button" className="danger" onClick={() => void run("bonk", { confirmed: "true" })}>Stop</button>
          <button type="button" onClick={() => setDialog(null)}>Cancel</button>
        </div>
      ) : dialog === "megaphone" ? (
        <form className="ej-confirm" onSubmit={(event) => { event.preventDefault(); void run("megaphone", { text }); }}>
          <input aria-label="Message to the whole team" value={text} onChange={(event) => setText(event.target.value)} placeholder="Message the whole team" />
          <button type="submit" className="primary" disabled={!text.trim()}>Send</button>
          <button type="button" onClick={() => setDialog(null)}>Cancel</button>
        </form>
      ) : (
        <div className="ej-actions-row">
          {WORK_ACTIONS.map((kind) => button(kind, true))}
          {calm ? null : (
            <>
              <span className="ej-sep" />
              {fun ? FUN_ACTIONS.map((kind) => button(kind, false)) : null}
              <button type="button" className={fun ? "ej-act on" : "ej-act"} aria-label={fun ? "Hide fun actions" : "Fun actions (local only)"} aria-expanded={fun}
                onMouseEnter={() => setHover(fun ? "Hide fun actions" : "Fun actions (local only)")} onMouseLeave={() => setHover("")}
                onClick={() => setFun((value) => !value)}>
                {fun ? <PixelIcon name="close" /> : icon("more")}
              </button>
            </>
          )}
        </div>
      )}
      <p className="ej-msg" aria-live="polite">{dialog ? "" : hover || message}</p>
    </div>
  );
}
