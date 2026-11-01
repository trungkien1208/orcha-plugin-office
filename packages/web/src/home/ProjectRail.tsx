import type { Agent, OfficeState, Project } from "@easy-job/shared";
import { Modal, ModalTitle } from "../ui/Modal.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api.ts";
import { CloseProject } from "../chat/Chat.tsx";
import { StageArt } from "../ui/ArtSprite.tsx";
import { openAccounts } from "../ui/Accounts.tsx";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu.tsx";
import { NewAgent, NewProject } from "./Launch.tsx";
import { LowFuel } from "../ui/Handoff.tsx";
import "./rail.css";
import { modelName, statusColor, waiting } from "../format.ts";
import { go, isUnread, selectPane, selectProject, serverNow } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { Icon } from "../ui/Icon.tsx";
import { Portrait } from "../ui/Header.tsx";

const ORDER = { blocked: 0, done: 1, working: 2, idle: 3, unknown: 4 };
type Filter = "all" | "blocked" | "working" | "done" | "idle";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "blocked", label: "Needs" },
  { id: "working", label: "Working" },
  { id: "done", label: "Done" },
  { id: "idle", label: "Idle" },
];

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem("easy-job-collapsed") ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeCollapsed(ids: string[]) {
  try {
    localStorage.setItem("easy-job-collapsed", JSON.stringify(ids));
  } catch {
    // Collapsed groups are a convenience only.
  }
}

/** A small popover menu; closes on a click outside or Esc. */

type Dialog =
  | { kind: "agent"; workspaceId: string }
  | { kind: "project" }
  | { kind: "close"; project: Project }
  | { kind: "broadcast"; project: Project }
  | { kind: "rename"; agent: Agent }
  | null;

/**
 * Projects and their Agents in one list (design A): a group per Project with "+" and a ⋯ menu,
 * Agents inside with their own ⋯ menu (chat, floor, Orcha, rename, remove). Used by Floor and Conversation.
 */
export function ProjectRail({ office, mode, wide, onToggle, onFloorToggle }: { office: OfficeState; mode: "floor" | "chat"; wide: boolean; onToggle?: () => void; onFloorToggle?: () => void }) {
  const snap = useOffice();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const [showEmpty, setShowEmpty] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const needle = query.trim().toLowerCase();
  const matches = (agent: Agent, project?: Project) => !needle || `${agent.name} ${agent.task ?? ""} ${project?.label ?? ""} ${agent.model ?? ""}`.toLowerCase().includes(needle);
  const all = office.agents.filter((agent) => matches(agent, office.projects.find((project) => project.workspaceId === agent.workspaceId)));
  const count = (id: Filter) => (id === "all" ? all.length : all.filter((agent) => agent.status === id).length);
  const groups = office.projects
    .map((project) => ({
      project,
      agents: office.agents
        .filter((agent) => agent.workspaceId === project.workspaceId && matches(agent, project) && (filter === "all" || agent.status === filter))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.waitingSince ?? 0) - (b.waitingSince ?? 0) || a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.agents.length)
    .sort((a, b) => Math.min(...a.agents.map((agent) => ORDER[agent.status])) - Math.min(...b.agents.map((agent) => ORDER[agent.status])) || a.project.label.localeCompare(b.project.label));
  const empty = office.projects.filter((project) => !office.agents.some((agent) => agent.workspaceId === project.workspaceId));
  const toggle = (id: string) => setCollapsed((list) => { const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id]; writeCollapsed(next); return next; });
  const open = (agent: Agent) => { selectPane(agent.paneId); if (mode === "chat") go({ name: "conversation", paneId: agent.paneId }); };
  const showOnFloor = (agent: Agent) => { selectPane(agent.paneId); go({ name: "home" }); };
  const act = (promise: Promise<unknown>, what: string) => { void promise.catch((err: unknown) => toast.error(err instanceof Error ? err.message : `Could not ${what}`)); };
  const currentProject = office.agents.find((agent) => agent.paneId === snap.paneId)?.workspaceId ?? office.projects[0]?.workspaceId ?? "";

  const projectMenu = (project: Project) => (
    <Menu label={`${project.label} menu`}>
      <MenuItem onSelect={() => { setDialog({ kind: "agent", workspaceId: project.workspaceId }); }}>New agent here</MenuItem>
      <MenuItem onSelect={() => { selectProject(project.workspaceId); go({ name: "home" }); }}>Show bench on Floor</MenuItem>
      <MenuItem onSelect={() => { setDialog({ kind: "broadcast", project }); }}>Message whole team…</MenuItem>
      <MenuSeparator />
      <MenuItem danger onSelect={() => { setDialog({ kind: "close", project }); }}>Close project…</MenuItem>
    </Menu>
  );

  const agentRow = (agent: Agent, project: Project) => {
    const color = project.projectColor;
    if (removing === agent.paneId) {
      return (
        <div key={agent.paneId} className="row-confirm" role="alertdialog" aria-label={`Remove ${agent.name}?`}>
          <span>Remove <b>{agent.name}</b>? Its pane in Orcha closes.</span>
          <span className="row-confirm-actions">
            <button type="button" className="btn danger" onClick={() => { setRemoving(null); act(api(`/api/agents/${encodeURIComponent(agent.paneId)}/close`, { method: "POST" }), "remove"); }}>Remove</button>
            <button type="button" className="btn ghost" onClick={() => setRemoving(null)}>Cancel</button>
          </span>
        </div>
      );
    }
    return (
      <div key={agent.paneId} className="prow">
        <button type="button" title={`${agent.name} · ${project.label}`} className={`agent-row ${agent.status}${snap.paneId === agent.paneId ? " sel" : ""}`} onClick={() => open(agent)}>
          <Portrait color={color} name={agent.name} skin={agent.skin} />
          <span className="lines">
            <span className="who"><span className="who-name">{agent.name}</span><span className="model">{modelName(agent.model, agent.kind)}</span></span>
            <span className="task">{agent.status === "working" ? <StageArt stage={agent.stage} /> : null}{agent.task || agent.stage || " "}</span>
          </span>
          {agent.status === "blocked"
            ? <span className="when" title={waiting(agent.waitingSince, serverNow())}>{waiting(agent.waitingSince, serverNow(), true)}</span>
            : isUnread(agent) ? <span className="unread" title="New since you last looked">new</span>
            : <i className="dot ring" style={{ "--c": statusColor(agent.status) } as CSSProperties} title={agent.status} />}
        </button>
        <LowFuel agent={agent}/><Menu label={`${agent.name} menu`}>
          <MenuItem onSelect={() => openAccounts(agent.paneId)}>Switch account…</MenuItem>
          <MenuItem onSelect={() => { selectPane(agent.paneId); go({ name: "conversation", paneId: agent.paneId }); }}>Open chat</MenuItem>
          <MenuItem onSelect={() => { showOnFloor(agent); }}>Show on Floor</MenuItem>
          <MenuItem onSelect={() => { act(api(`/api/agents/${encodeURIComponent(agent.paneId)}/focus`, { method: "POST" }), "open in Orcha"); }}>Open in Orcha</MenuItem>
          <MenuItem onSelect={() => { setDialog({ kind: "rename", agent }); }}>Rename…</MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => { setRemoving(agent.paneId); }}>Remove agent</MenuItem>
        </Menu>
      </div>
    );
  };

  return (
    <aside className="rail prail" aria-label="Projects and agents">
      <div className="rail-head">
        <div className="rail-top">
          {onToggle ? <button type="button" className="rail-toggle" onClick={onToggle} aria-label={wide ? "Collapse the list" : "Expand the list"} title={wide ? "Collapse the list" : "Expand the list"}><Icon name={wide ? "chevron-left" : "chevron-right"} />{wide ? null : <span className="foot-label">List</span>}</button> : null}
          <input className="search" placeholder="Search agents and projects" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search agents and projects" />
          {onFloorToggle ? <button type="button" className="btn floor-toggle" onClick={onFloorToggle} title="Floor" aria-label="Floor">Floor</button> : null}
        </div>
        <div className="filters" role="tablist" aria-label="Status">
          {FILTERS.map((item) => {
            const n = count(item.id);
            if (item.id !== "all" && !n) return null;
            return (
              <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={`filter ${item.id}`} onClick={() => setFilter(item.id)}>
                {item.label} <b>{n}</b>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rail-list">
        {groups.map(({ project, agents }) => {
          const shut = collapsed.includes(project.workspaceId) && !needle;
          const needs = agents.filter((agent) => agent.status === "blocked").length;
          const fresh = agents.filter((agent) => isUnread(agent)).length;
          return (
            <section key={project.workspaceId} className="pgroup" style={{ "--pc": project.projectColor } as CSSProperties}>
              <div className="phead">
                <button type="button" className="ptoggle" aria-expanded={!shut} onClick={() => toggle(project.workspaceId)} title={project.cwd ?? project.label}>
                  <span className="caret"><Icon name={shut ? "caret-right" : "caret-down"} /></span>
                  <i className="pswatch" />
                  <span className="plabel">{project.label}</span>
                  {needs ? <span className="pneeds">{needs}</span> : null}
                  {fresh && shut ? <span className="pfresh" title="Agents with news">{fresh} new</span> : null}
                  <span className="pcount">{agents.length}</span>
                </button>
                <span className="pactions">
                  <button type="button" className="row-more" aria-label={`New agent in ${project.label}`} title="New agent here" onClick={() => setDialog({ kind: "agent", workspaceId: project.workspaceId })}><Icon name="new-agent" /></button>
                  {projectMenu(project)}
                </span>
              </div>
              {shut ? null : agents.map((agent) => agentRow(agent, project))}
            </section>
          );
        })}
        {groups.length ? null : <p className="notice">No agents match.</p>}
        {empty.length && !needle && filter === "all" ? (
          <section className="pgroup quiet">
            <button type="button" className="ptoggle" aria-expanded={showEmpty} onClick={() => setShowEmpty((value) => !value)}>
              <span className="caret"><Icon name={showEmpty ? "caret-down" : "caret-right"} /></span><span className="plabel">{empty.length} empty projects</span>
            </button>
            {showEmpty ? empty.map((project) => (
              <div key={project.workspaceId} className="phead" style={{ "--pc": project.projectColor } as CSSProperties}>
                <span className="ptoggle static"><i className="pswatch" /><span className="plabel">{project.label}</span></span>
                <span className="pactions">
                  <button type="button" className="row-more" aria-label={`New agent in ${project.label}`} title="New agent here" onClick={() => setDialog({ kind: "agent", workspaceId: project.workspaceId })}><Icon name="new-agent" /></button>
                  {projectMenu(project)}
                </span>
              </div>
            )) : null}
          </section>
        ) : null}
      </div>
      <div className="rail-foot">
        <button type="button" className="btn primary" title="New agent" aria-label="New agent" onClick={() => setDialog({ kind: "agent", workspaceId: currentProject })}><Icon name="new-agent" /><span className="foot-label">{wide ? "New agent" : "Agent"}</span></button>
        <button type="button" className="btn" title="New project" aria-label="New project" onClick={() => setDialog({ kind: "project" })}><Icon name="new-project" /><span className="foot-label">{wide ? "New project" : "Project"}</span></button>
      </div>
      {dialog?.kind === "agent" ? <NewAgent projects={office.projects} initial={dialog.workspaceId} close={() => setDialog(null)} /> : null}
      {dialog?.kind === "project" ? <NewProject projects={office.projects} close={() => setDialog(null)} /> : null}
      {dialog?.kind === "close" ? <CloseProject project={dialog.project} close={() => setDialog(null)} /> : null}
      {dialog?.kind === "broadcast" ? <Broadcast project={dialog.project} close={() => setDialog(null)} /> : null}
      {dialog?.kind === "rename" ? <Rename agent={dialog.agent} close={() => setDialog(null)} /> : null}
    </aside>
  );
}

function Broadcast({ project, close }: { project: Project; close: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={close}>
      <form className="panel" onSubmit={(event) => {
        event.preventDefault();
        void api(`/api/projects/${encodeURIComponent(project.workspaceId)}/broadcast`, { method: "POST", body: JSON.stringify({ text }) })
          .then(close)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not send"));
      }}>
        <ModalTitle>Message {project.label}</ModalTitle>
        <p className="task">Sent as a prompt to every agent in this project.</p>
        <label>Message <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="e.g. stand-up in 5" /></label>
        {error ? <p className="err">{error}</p> : null}
        <div className="row">
          <button className="btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!text.trim()}>Send to team</button>
        </div>
      </form>
    </Modal>
  );
}

function Rename({ agent, close }: { agent: Agent; close: () => void }) {
  const [name, setName] = useState(agent.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={close}>
      <form className="panel" onSubmit={(event) => {
        event.preventDefault();
        void api(`/api/agents/${encodeURIComponent(agent.paneId)}/rename`, { method: "POST", body: JSON.stringify({ name }) })
          .then(close)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not rename"));
      }}>
        <ModalTitle>Rename agent</ModalTitle>
        <label>Name <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" /></label>
        {error ? <p className="err">{error}</p> : null}
        <div className="row">
          <button className="btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!name.trim() || name === agent.name}>Rename</button>
        </div>
      </form>
    </Modal>
  );
}
