import type { Agent, Fuel, Project } from "@easy-job/shared";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { ago, modelName, until } from "../format.ts";
import { useOffice } from "../useOffice.ts";
import { ArtSprite } from "../ui/ArtSprite.tsx";
import { KindIcon, Portrait } from "../ui/Header.tsx";
import "./context.css";


/** The Agent's "HP": fuel left in its account's 5-hour window (or the first window it has). */
export function FuelBar({ fuel, compact }: { fuel?: Fuel | null; compact?: boolean }) {
  const window = fuel?.windows[0];
  if (!window) return compact ? null : <span className="fuel none" title="No fuel data from Orcha yet">fuel —</span>;
  const tone = window.left < 15 ? "low" : window.left < 40 ? "mid" : "ok";
  const title = `${fuel?.label ?? ""} · ${fuel?.windows.map((w) => `${w.label} ${w.left}% left${w.resetAt ? ` (resets in ${until(w.resetAt)})` : ""}`).join(" · ")}`;
  return (
    <span className={`fuel ${tone}${compact ? " compact" : ""}`} title={title}>
      {compact ? null : <span className="fuel-label">{window.label}</span>}
      <span className="fuel-track"><span className="fuel-fill" style={{ width: `${window.left}%` }} /></span>
      {compact ? null : <span className="fuel-pct">{window.left}%</span>}
    </span>
  );
}

/**
 * The Agent's health in the header: HP is the 5-hour window (heart), stamina the weekly one (bolt).
 * Falls back to whatever windows the account has.
 */
export function HealthBars({ fuel }: { fuel?: Fuel | null }) {
  if (!fuel?.windows.length) return <span className="health none" title="No fuel data from Orcha yet">HP —</span>;
  const hp = fuel.windows.find((w) => w.key === "session") ?? fuel.windows[0];
  const stamina = fuel.windows.find((w) => w.key === "weekly" && w !== hp);
  const bar = (w: typeof hp, kind: "hp" | "stamina") => {
    if (!w) return null;
    const tone = kind === "stamina" ? "stamina" : w.left < 15 ? "low" : w.left < 40 ? "mid" : "ok";
    return (
      <span className={`hbar ${tone}`} title={`${kind === "hp" ? "HP" : "Stamina"} · ${w.label} ${w.left}% left${w.resetAt ? ` · resets in ${until(w.resetAt)}` : ""}`}>
        <span className="hicon" aria-hidden="true"></span>
        <span className="hlabel">{w.label}</span>
        <span className="htrack"><span className="hfill" style={{ width: `${w.left}%` }} /></span>
        <span className="hpct">{w.left}%</span>
        {w.resetAt ? <span className="hreset">{until(w.resetAt)}</span> : null}
      </span>
    );
  };
  return <span className="health" title={`${fuel.label} fuel`}>{bar(hp, "hp")}{bar(stamina, "stamina")}</span>;
}

export { useAgentContext } from "../queries.ts";
import { useAgentContext } from "../queries.ts";


const STATUS_CLASS: Record<string, string> = { M: "mod", A: "add", D: "del", R: "mod" };

/** Orcha-style right panel: FUEL, BRANCH, CHANGES, HISTORY, WORKTREES. */
export function ContextPanel({ paneId, onOpenFile }: { paneId: string; onOpenFile: (path: string) => void }) {
  const data = useAgentContext(paneId);
  const git = data?.git;
  return (
    <aside className="context" aria-label="Agent context">
      <section className="ctx">
        <header><span>Fuel</span><span className="muted">{data?.fuel?.label ?? ""}</span></header>
        {data?.fuel?.windows.length ? data.fuel.windows.map((window) => (
          <div key={window.key} className="fuel-row">
            <span className="fuel-label">{window.label}</span>
            <FuelBar fuel={{ ...data.fuel, windows: [window] } as Fuel} compact />
            <b className={window.left < 15 ? "low" : window.left < 40 ? "mid" : ""}>{window.left}%</b>
            {window.resetAt ? <span className="muted">resets in {until(window.resetAt)}</span> : null}
          </div>
        )) : <p className="muted">No fuel data yet. Orcha fills it when it checks the account.</p>}
        {data?.fuel?.note ? <p className="muted">{data.fuel.note}</p> : null}
      </section>
      <section className="ctx">
        <header><span>Branch</span>{git && (git.ahead || git.behind) ? <span className="muted">{git.ahead ? `↑${git.ahead} to push` : ""}{git.behind ? ` ↓${git.behind}` : ""}</span> : null}</header>
        {git ? <><p className="branch" title={git.branch}>⌥ {git.branch || "detached"}</p>{git.upstream ? <p className="muted branch-up" title={git.upstream}>→ {git.upstream}</p> : null}</> : <p className="muted">Not a git repository.</p>}
      </section>
      {git ? (
        <>
          <section className="ctx">
            <header><span>Changes</span><span className="muted"><span className="add">+{git.added}</span> <span className="del">−{git.removed}</span></span></header>
            {git.changes.length ? git.changes.slice(0, 40).map((change) => (
              <button key={change.path} type="button" className="ctx-file" onClick={() => onOpenFile(change.path)} title={change.path}>
                <b className={STATUS_CLASS[change.status] ?? "mod"}><ArtSprite name="git-status" frame={Math.max(0,["M","A","D","R"].indexOf(change.status))} columns={4}/><span className="sr-only">{change.status}</span></b>
                <span>{change.path}</span>
              </button>
            )) : <p className="muted">Working tree clean.</p>}
          </section>
          <details className="ctx" open>
            <summary><span>History</span><span className="muted">{git.history.length}</span></summary>
            {git.history.map((commit) => (
              <div key={commit.sha} className="ctx-commit" title={commit.subject}><code className="sha">{commit.sha}</code><span>{commit.subject}</span><span className="muted">{ago(commit.at)}</span></div>
            ))}
          </details>
          <details className="ctx">
            <summary><span>Worktrees</span><span className="muted">{git.worktrees.length}</span></summary>
            {git.worktrees.map((tree) => (
              <div key={tree.path} className={tree.current ? "ctx-commit current" : "ctx-commit"} title={tree.path}><code className="sha">{tree.branch || "—"}</code><span>{tree.path.split("/").slice(-2).join("/")}</span></div>
            ))}
          </details>
        </>
      ) : null}
    </aside>
  );
}

/** Changes and Files tabs: list on the left, read-only viewer on the right. Text only, never HTML. */
/** Setup tab: identity, look, account and the destructive actions, all in one place. */
export function SetupView({ agent, project, onCloseProject }: { agent: Agent; project?: Project; onCloseProject: () => void }) {
  const snap = useOffice();
  const data = useAgentContext(agent.paneId);
  const [name, setName] = useState(agent.name);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setName(agent.name), [agent.name]);
  const skins = snap.office?.catalog.skins ?? [];
  const base = `/api/agents/${encodeURIComponent(agent.paneId)}`;
  const color = project?.projectColor ?? "#888";
  return (
    <div className="setup">
      <section className="setup-block">
        <h3>Identity</h3>
        <form className="rename" onSubmit={(event) => { event.preventDefault(); void api(`${base}/rename`, { method: "POST", body: JSON.stringify({ name }) }).then(() => setMessage("Renamed in Orcha.")).catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Could not rename")); }}>
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Rename" />
          <button className="btn primary" type="submit">Rename</button>
        </form>
        <dl className="facts">
          <dt>Kind</dt><dd><KindIcon kind={agent.kind} model={agent.model} /> {agent.kind} · {modelName(agent.model, agent.kind)}</dd>
          <dt>Project</dt><dd>{project?.label}</dd>
          <dt>Folder</dt><dd className="mono">{agent.cwd}</dd>
          <dt>Pane</dt><dd className="mono">{agent.paneId}</dd>
          <dt>Account</dt><dd>{data?.fuel ? `${data.fuel.label} · ` : ""}<FuelBar fuel={data?.fuel} /></dd>
        </dl>
        <div className="row"><button type="button" className="btn" onClick={() => void api(`${base}/focus`, { method: "POST" })}>↗ Open in Orcha</button></div>
      </section>
      <section className="setup-block">
        <h3>Look</h3>
        <div className="skins">
          {skins.map((skin) => (
            <button key={skin.id} type="button" className={skin.id === agent.skin ? "skin sel" : "skin"} title={skin.name} onClick={() => void api(`${base}/skin`, { method: "PUT", body: JSON.stringify({ skin: skin.id }) })}>
              <Portrait color={color} name={skin.name} skin={skin.id} />
              <span>{skin.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="setup-block danger-zone">
        <h3>Danger zone</h3>
        {removing ? (
          <div className="confirm">
            <p>Remove {agent.name}? This closes its pane in Orcha and stops the agent.</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => setRemoving(false)}>Cancel</button>
              <button type="button" className="btn danger" onClick={() => void api(`${base}/close`, { method: "POST" }).catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Could not remove"))}>Remove</button>
            </div>
          </div>
        ) : <button type="button" className="btn danger-ghost" onClick={() => setRemoving(true)}>Remove agent</button>}
        {project ? <button type="button" className="btn danger-ghost" onClick={onCloseProject}>Close project {project.label}</button> : null}
      </section>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}

