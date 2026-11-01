import { useState } from "react";
import type { ReactNode } from "react";
import { HURRY } from "../floor/actions.ts";
import { askNotifications, beginUpdate, checkForUpdate, go, setCalm, setMuted, setTheme, unlockSound, type SettingsSection } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { AccountsPanel } from "../ui/AccountsSettings.tsx";
import "./settings.css";

const SECTIONS: Array<{ id: SettingsSection; label: string; hint: string }> = [
  { id: "general", label: "General", hint: "Theme, motion, sound" },
  { id: "accounts", label: "Accounts", hint: "Sign-in and fuel" },
  { id: "boss", label: "Boss", hint: "What the Boss says" },
  { id: "connection", label: "Connection", hint: "Orcha and the bridge" },
];

function stored(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* per-browser convenience */ }
}

/** Full-page settings, one section at a time; every change applies right away. */
export function SettingsView({ section }: { section: SettingsSection }) {
  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
  return (
    <main className="workspace settings-page">
      <section className="card settings-card" aria-label="Settings">
        <nav className="settings-nav" aria-label="Settings sections">
          <h1>Settings</h1>
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" aria-current={item.id === section ? "page" : undefined} onClick={() => go({ name: "settings", section: item.id })}>
              <b>{item.label}</b><small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <h2>{current?.label}</h2>
          {section === "general" ? <General /> : section === "accounts" ? <AccountsPanel /> : section === "boss" ? <Boss /> : <Connection />}
        </div>
      </section>
    </main>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span><b>{title}</b>{hint ? <small>{hint}</small> : null}</span>
      <span className="settings-control">{children}</span>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={on} className="fast-switch" onClick={() => onChange(!on)}>
      <span className="fast-switch-track" aria-hidden="true"><span /></span>
    </button>
  );
}

function General() {
  const snap = useOffice();
  const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  return (
    <div className="settings-stack">
      <Row title="Theme" hint="Same office, two looks.">
        <span className="theme-choice">
          {(["compound", "office"] as const).map((theme) => (
            <label key={theme} className={snap.theme === theme ? "on" : undefined}>
              <input type="radio" name="theme" checked={snap.theme === theme} onChange={() => setTheme(theme)} />
              {theme === "compound" ? "Compound" : "Cozy Office"}
            </label>
          ))}
        </span>
      </Row>
      <Row title="Calm mode" hint="No motion, no fire, no gags, no sound."><Toggle label="Calm mode" on={snap.calm} onChange={setCalm} /></Row>
      <Row title="Sound" hint={snap.soundUnlocked ? "A chime when an Agent needs you or finishes." : "Browsers need one click before playing sound."}>
        {snap.soundUnlocked ? <Toggle label="Sound" on={!snap.muted} onChange={(on) => setMuted(!on)} /> : <button type="button" className="btn" onClick={() => unlockSound()}>Enable sound</button>}
      </Row>
      <Row title="Notifications" hint="A desktop notification when an Agent needs you.">
        {permission === "granted" ? <span className="acct-tag">On</span>
          : permission === "unsupported" ? <span className="muted">Not supported here</span>
          : <button type="button" className="btn" onClick={() => void askNotifications().then(() => setPermission(Notification.permission))}>{permission === "denied" ? "Blocked in the browser" : "Turn on"}</button>}
      </Row>
    </div>
  );
}

function Boss() {
  const [nudge, setNudge] = useState(() => stored("easy-job-nudge", "continue"));
  const [hurry, setHurry] = useState(() => stored("easy-job-hurry", HURRY));
  return (
    <div className="settings-stack">
      <p className="muted">Sent to the Agent when the Boss acts on the Floor. Saved in this browser as you type.</p>
      <label className="settings-field">Nudge (knock on a desk)<input value={nudge} onChange={(event) => { setNudge(event.target.value); store("easy-job-nudge", event.target.value); }} /></label>
      <label className="settings-field">Faster! (crack the whip)<input value={hurry} onChange={(event) => { setHurry(event.target.value); store("easy-job-hurry", event.target.value); }} /></label>
    </div>
  );
}

function UpdateRow() {
  const snap = useOffice();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const update = snap.update;
  const updating = snap.updateFlow.phase === "updating";
  const status = !update?.available || !update.latest || update.latest === update.running
    ? "Up to date"
    : update.compatible
      ? `Easy Job ${update.latest} is out`
      : `Easy Job ${update.latest} needs a newer Orcha; run orcha update`;
  return (
    <span className="settings-update">
      <span>{updating ? "Updating…" : error || status}</span>
      {update?.available && update.compatible && update.latest !== update.running && !updating ? (
        <button type="button" className="btn" onClick={() => void beginUpdate()}>Update</button>
      ) : null}
      <button
        type="button"
        className="btn"
        disabled={checking || updating}
        title="Orcha asks GitHub now; it also checks once a day by itself"
        onClick={() => {
          setChecking(true);
          setError("");
          void checkForUpdate()
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Check failed"))
            .finally(() => setChecking(false));
        }}
      >
        {checking ? "Checking…" : "Check now"}
      </button>
    </span>
  );
}

function Connection() {
  const snap = useOffice();
  const orcha = snap.office?.orcha;
  const caps = snap.office?.capabilities;
  const facts: Array<[string, ReactNode]> = [
    ["Easy Job version", snap.app ?? "—"],
    ["Browser ↔ bridge", snap.socket === "open" ? "Connected" : "Reconnecting…"],
    ["Bridge ↔ Orcha", orcha?.connected ? "Connected" : "Orcha isn't running"],
    ["Orcha version", orcha?.version ?? "—"],
    ["Protocol", orcha?.protocol ?? "—"],
    ["Socket", <code key="socket">{orcha?.socketPath ?? "—"}</code>],
    ["Account API", caps?.accountApi ? "Available" : "Not in this Orcha"],
    ["Hand off", caps?.handoff ? "Available" : "handoff.py not installed"],
  ];
  // Only an Orcha with the plugin update API gets this row; an older one shows nothing about updates.
  if (snap.update?.supported) facts.splice(1, 0, ["Updates", <UpdateRow key="updates" />]);
  return (
    <div className="settings-stack">
      {orcha?.protocolWarning ? <p className="settings-note">{orcha.protocolWarning}</p> : null}
      <dl className="settings-facts">{facts.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    </div>
  );
}
