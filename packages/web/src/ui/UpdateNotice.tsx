import { useEffect, useState } from "react";
import { beginUpdate, dismissUpdate } from "../store.ts";
import { noticeFor } from "../update-flow.ts";
import { useOffice } from "../useOffice.ts";
import "./batch1.css";

/** Easy Job's own update: offer, progress through the restart, and a copyable build log when it fails. */
export function UpdateNotice() {
  const snap = useOffice();
  const [copied, setCopied] = useState(false);
  const notice = noticeFor(snap.update, snap.updateFlow, snap.updateDismissed, Date.now());
  const kind = notice?.kind;
  useEffect(() => {
    if (kind !== "done") return;
    const timer = window.setTimeout(dismissUpdate, 8000);
    return () => window.clearTimeout(timer);
  }, [kind]);
  if (!notice || snap.tokenMissing) return null;
  // An offer can't be acted on while the page is offline; the connection notice has that spot.
  if ((notice.kind === "offer" || notice.kind === "incompatible") && snap.socket !== "open") return null;
  const close = (
    <button type="button" className="update-close" aria-label="Dismiss" title="Dismiss" onClick={dismissUpdate}>
      ×
    </button>
  );
  if (notice.kind === "offer")
    return (
      <aside className="connection-notice update-notice" role="status">
        <span>
          Easy Job {notice.version} is out ·{" "}
        </span>
        <button type="button" className="update-go" onClick={() => void beginUpdate()}>
          Update
        </button>
        {close}
      </aside>
    );
  if (notice.kind === "incompatible")
    return (
      <aside className="connection-notice update-notice" role="status">
        <span>
          Easy Job {notice.version} needs a newer Orcha; run <code>orcha update</code>
        </span>
        {close}
      </aside>
    );
  if (notice.kind === "updating")
    return (
      <aside className="connection-notice update-notice" role="status" aria-live="polite">
        <b>Updating Easy Job to {notice.version}…</b>
        <p>
          {notice.slow
            ? "Still working. The Easy Job pane in Orcha shows the build."
            : "Easy Job restarts by itself and this page reconnects."}
        </p>
      </aside>
    );
  if (notice.kind === "installed")
    return (
      <aside className="connection-notice update-notice" role="status">
        <span>
          Easy Job {notice.version} is installed. Restart it to use it: <code>easy-job stop</code>, then{" "}
          <code>orcha office</code>.
        </span>
        {close}
      </aside>
    );
  if (notice.kind === "done")
    return (
      <aside className="connection-notice update-notice" role="status">
        <span>Easy Job {notice.version} is ready.</span>
        {close}
      </aside>
    );
  const log = notice.log;
  return (
    <aside className="connection-notice update-notice update-failed" role="alert">
      <header>
        <b>Couldn't update to Easy Job {notice.version}</b>
        {close}
      </header>
      <p>{notice.error}</p>
      {log ? (
        <>
          <pre className="update-log">
            {log}
          </pre>
          <footer>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(log)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  })
                  .catch(() => undefined);
              }}
            >
              {copied ? "Copied" : "Copy log"}
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}
