import type { CSSProperties, Ref } from "react";
import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART } from "./art.generated";
import { DOCS_URL, HOUSE_RULES, type Theme } from "./data";
import { InstallCommands } from "./Install";
import { type Scene, Vignette } from "./Vignette";

const notices: { scene: Scene; title: string; text: string }[] = [
  {scene:"bench",title:"Four Desks to a Bench",text:"Each Orcha workspace becomes a Project. Its Agents sit together at a Bench in their Project colour. Every Agent keeps its Desk."},
  {scene:"needs",title:"A hand means Needs you",text:"Read the Question and send an Answer. The Agent gets back to work. Try answering the hand above."},
  {scene:"seen",title:"Done until you have Seen it",text:"A finished Agent stays on the attention list until you look. Mark the finish Seen and it becomes idle."},
  {scene:"boss",title:"A delivery from the Boss",text:"Walk the Floor with keys or clicks. Knock for a Nudge, or use the megaphone to Broadcast a Prompt to a Project."},
  {scene:"hr",title:"HR handles departures",text:"Two HR bouncers carry an ended Agent out. Live Agents keep their Desks. Exit interviews are unusually brief."},
];

function Paper() {
  const now = new Date();
  return <article className="office-paper" aria-labelledby="pitch-title">
    <div className="paper-masthead">The Daily Standup</div>
    <div className="paper-dateline"><time dateTime={now.toISOString()}>{now.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</time><span>Office edition · Nº 001</span></div>
    <h2 id="pitch-title">The Floor is open for inspection</h2>
    <div className="paper-columns">
      <p>Easy Job is a local view of what Orcha is running. Orcha workspaces become Benches, and Agents sit at Desks. You walk the Floor as the Boss and answer whoever raised a hand.</p>
      <p>Choose an Agent to read its Conversation. A blue monitor means Working, a raised hand means Needs you, and green means Done. The office above uses sample Projects; your own office runs on your machine.</p>
      <aside className="paper-index"><b>In this edition</b><a href="#notice-board">Notices from the Floor</a><a href="#office-rules">Office rules</a><a href="#time-card">Take your time card</a></aside>
    </div>
  </article>;
}

function NoticeBoard({calm,theme}:{calm:boolean;theme:Theme}) {
  return <section className="notice-board" id="notice-board" aria-labelledby="board-title">
    <header className="board-header"><h3 id="board-title">Notices from the Floor</h3><span>Please leave the pins here.</span></header>
    <div className="board-notes">{notices.map(({scene,title,text},index)=><article className={`board-note board-note-${scene}`} key={scene}>
      <span className="notice-pin" aria-hidden="true" />
      <span className="notice-number">{String(index+1).padStart(2,"0")}</span>
      <Vignette scene={scene} calm={calm} theme={theme}/>
      <h4>{title}</h4><p>{text}</p>
    </article>)}</div>
  </section>;
}

function OfficeRules() {
  return <article className="office-rules" id="office-rules" aria-labelledby="rules-title"><span className="notice-reference">Staff notice / 003</span><h3 id="rules-title">Office rules</h3><ol>{HOUSE_RULES.map(rule=><li key={rule.title}><b>{rule.title}</b><p>{rule.body}</p></li>)}</ol><p className="rules-signature">Filed by the Boss</p></article>;
}

function TimeCard() {
  return <article className="time-card" id="time-card" aria-labelledby="time-card-title"><header><h3 id="time-card-title">Time card</h3><span>Nº 001 · THE BOSS</span></header><p>From the Easy Job project folder:</p><InstallCommands timeCard/><a className="setup-docs" href={DOCS_URL}>Read the setup guide</a></article>;
}

/** The office's own paperwork, filed below the playable Floor. */
export function Pitch({ref,inert,calm,theme}:{ref:Ref<HTMLElement>;inert:boolean;calm:boolean;theme:Theme}) {
  const objects=LANDING_ART.paperwork[theme];
  const style=Object.fromEntries(Object.entries(objects).map(([key,path])=>[`--art-${key}`,`url("${officeAssetUrl(path)}")`])) as CSSProperties;
  return <section className="pitch" id="about" ref={ref} inert={inert} style={style} aria-labelledby="pitch-title">
    <Paper/><NoticeBoard calm={calm} theme={theme}/><div className="paperwork-desk"><OfficeRules/><TimeCard/></div>
    <footer className="pitch-footer">Easy Job is a local client for Orcha.</footer>
  </section>;
}
