import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { clock } from "../format.ts";
import { go, selectPane, setTheme } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { ArtSprite } from "./ArtSprite.tsx";
import { Icon } from "./Icon.tsx";
import { QuickSwitch } from "./QuickSwitch.tsx";
import "./hud.css";
import { FloorPortrait } from "../floor/Portrait.tsx";

/** Slim header: what needs you first, then a one-line summary, then icon controls. */
const BRAND_LOGO = "/office/landing/brand/easy-chair-144.png";
const BRAND_ICON = "/office/landing/brand/easy-chair-32.png";

/** The tab icon: the Easy Job chair, with a gold dot while an Agent needs you. */
function setFavicon(needs: boolean) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }
  const target = link;
  if (!needs) {
    target.href = BRAND_ICON;
    return;
  }
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, 32, 32);
    context.beginPath();
    context.arc(25, 7, 6, 0, Math.PI * 2);
    context.fillStyle = "#e8b13a";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#3b2f2a";
    context.stroke();
    target.href = canvas.toDataURL("image/png");
  };
  image.src = BRAND_ICON;
}

export function Header() {
  const snap = useOffice();
  const office = snap.office;
  const counts = office?.counts;
  const route = snap.route.name;
  const theme = snap.theme;
  const live = snap.socket === "open" && office?.orcha.connected;
  const liveTitle = snap.socket !== "open"
    ? "Reconnecting… data may be out of date"
    : !live
      ? "Orcha isn't running"
      : office?.orcha.protocolWarning ?? "Live";
  useEffect(() => setFavicon(!!counts?.needsMe), [counts?.needsMe]);
  const waiting = office?.agents.filter((agent) => agent.status === "blocked").sort((a, b) => (a.waitingSince ?? 0) - (b.waitingSince ?? 0)) ?? [];
  const chatTarget = snap.paneId ?? waiting[0]?.paneId ?? office?.agents[0]?.paneId;
  return (
    <header className="hud">
      <div className="logo"><img className="logo-img" src={BRAND_LOGO} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /><span className="logo-word">Easy Job</span></div>
      <nav className="tabs" aria-label="Views">
        <button type="button" aria-current={route === "home" ? "page" : undefined} onClick={() => go({ name: "home" })}>Floor</button>
        <button type="button" aria-current={route === "conversation" ? "page" : undefined} onClick={() => chatTarget && go({ name: "conversation", paneId: chatTarget })}>Conversation</button>
      </nav>
      <button
        type="button"
        className={waiting.length ? "needs-btn" : "needs-btn none"}
        onClick={() => waiting[0] && selectPane(waiting[0].paneId)}
        title={waiting.length ? "Answer the Agent that has waited longest" : "Nobody needs you"}
      >
        <span className="n">{counts?.needsMe ?? 0}</span>
        <span className="needs-label">{waiting.length ? "need you" : "all clear"}</span>
      </button>
      <div className="summary">
        <span><b>{counts?.working ?? 0}</b> working</span>
        <span><b>{counts?.done ?? 0}</b> done</span>
      </div>
      <span className="grow" />
      <button type="button" className="quick-open" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))} title="Jump to an agent or project (⌘K)" aria-label="Jump to an agent or project"><Icon name="search" /><kbd>⌘K</kbd></button>
      <span className={live ? "live-chip on" : snap.socket === "open" ? "live-chip" : "live-chip wait"} title={liveTitle}><i className={live ? "live on" : snap.socket === "open" ? "live" : "live wait"} title={liveTitle} /><Clock /></span>
      <button type="button" className="icon-btn theme-btn" aria-label={theme === "office" ? "Switch to the Compound theme" : "Switch to the Cozy Office theme"} title={theme === "office" ? "Theme: Cozy Office (click for Compound)" : "Theme: Compound (click for Cozy Office)"} onClick={() => setTheme(theme === "office" ? "compound" : "office")}><Icon name={theme === "office" ? "theme-office" : "theme-compound"} /></button>
      <button type="button" className={route === "settings" ? "icon-btn on" : "icon-btn"} aria-label="Settings" title="Settings" aria-current={route === "settings" ? "page" : undefined} onClick={() => go({ name: "settings", section: "general" })}><Icon name="settings" /></button>
      <QuickSwitch />
    </header>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="clock">{clock(now, true)}</span>;
}

export function Gate({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="gate">
      <section className="card">
        <h1>{title}</h1>
        <div>{body}</div>
      </section>
    </div>
  );
}

export function Portrait({ color, name, skin, large }: { color: string; name: string; skin?: string; large?: boolean }) {
  return (
    <span className={large ? "portrait lg" : "portrait"} style={{ background: color }} title={name}>
      {skin ? <FloorPortrait skin={skin} color={color} size={32} /> : null}
    </span>
  );
}

/** Model badge follows the actual model string, falling back to its agent kind. */
export function KindIcon({kind,model}:{kind:string;model?:string}) {
 const family=(model||kind).toLowerCase();const index=["opus","sonnet","haiku","gpt","codex","cursor"].findIndex(name=>family.includes(name));
 return <span title={model||kind}><ArtSprite name="badge-model" frame={index<0?6:index} columns={7}/></span>;
}
