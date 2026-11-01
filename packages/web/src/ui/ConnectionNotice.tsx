import { useEffect, useRef, useState } from "react";
import { startOrcha } from "../api-accounts.ts";
import { retryConnection } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import "./batch1.css";
export function ConnectionNotice() {
  const snap = useOffice(),
    [now, setNow] = useState(Date.now()),
    [since, setSince] = useState(Date.now()),
    [toast, setToast] = useState(false),
    [hidden, setHidden] = useState<string>(),
    [message, setMessage] = useState(""),
    [starting, setStarting] = useState(false);
  const connected = snap.socket === "open" && !!snap.office?.orcha.connected,
    previous = useRef(connected),
    lost = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connected) {
      if (previous.current || snap.socket === "closed" || snap.office) lost.current = true;
      setSince(Date.now());
    } else if (lost.current && !previous.current) {
      setToast(true);
      lost.current = false;
    }
    previous.current = connected;
  }, [connected, snap.socket, snap.office]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 2000);
    return () => clearTimeout(timer);
  }, [toast]);
  // During Easy Job's own update the bridge restarts on purpose; the update notice explains it.
  if (snap.tokenMissing || snap.updateFlow.phase === "updating") return null;
  const warning = snap.office?.orcha.protocolWarning;
  const delay = Math.max(0, Math.ceil(((snap.reconnectAt ?? now + 3000) - now) / 1000));
  if (snap.socket === "closed")
    return (
      <aside className="connection-notice" role="status">
        <b>Lost connection to Easy Job.</b> Retrying in {delay} s…{" "}
        <button type="button" onClick={retryConnection}>
          Retry now
        </button>
        {now - since > 30000 ? (
          <p>
            Is the bridge running? <code>easy-job status</code>
          </p>
        ) : null}
      </aside>
    );
  if (snap.office && !snap.office.orcha.connected)
    return (
      <aside className="connection-notice" role="status">
        <b>Orcha isn't running</b>
        <p className="mono">{snap.office.orcha.socketPath}</p>
        <button
          type="button"
          disabled={starting}
          onClick={() => {
            setStarting(true);
            void startOrcha()
              .then((r) => setMessage(r.available ? r.data.message : r.reason))
              .catch((e) => setMessage(String(e)))
              .finally(() => setStarting(false));
          }}
        >
          Start Orcha
        </button>
        <p>{message}</p>
      </aside>
    );
  if (toast)
    return (
      <aside className="connection-notice" role="status">
        Back online
      </aside>
    );
  if (warning && hidden !== warning)
    return (
      <aside className="connection-notice" role="status">
        {warning}
        <button type="button" onClick={() => setHidden(warning)}>
          Dismiss
        </button>
      </aside>
    );
  return null;
}
