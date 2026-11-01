import type { OfficeState } from "@easy-job/shared";
import { Modal, ModalTitle } from "../ui/Modal.tsx";
import { Component, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { api } from "../api.ts";
import { ChatPanel, openFileHook } from "../chat/Chat.tsx";
import { ContextPanel } from "../chat/Context.tsx";
import type { FloorSettings, WorkAction } from "../floor/contract.ts";
import { HURRY } from "../floor/actions.ts";
import { FloorView } from "../floor/FloorView.tsx";
import { clock, statusColor } from "../format.ts";
import { useFuel } from "../queries.ts";
import { go, markSent, selectPane, selectProject } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { ProjectRail } from "./ProjectRail.tsx";

function readRail(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem("easy-job-rail") ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeRail(value: Record<string, boolean>) {
  try {
    localStorage.setItem("easy-job-rail", JSON.stringify(value));
  } catch {
    // Remembering the rail width is a convenience only.
  }
}

function readDetails(): boolean {
  try {
    return localStorage.getItem("easy-job-details") === "1";
  } catch {
    return false;
  }
}

function writeDetails(open: boolean) {
  try {
    localStorage.setItem("easy-job-details", open ? "1" : "0");
  } catch {
    // Remembering the details drawer is a convenience only.
  }
}

export function Home() {
  return <Workspace mode="floor" />;
}

const ORDER = { blocked: 0, done: 1, working: 2, idle: 3, unknown: 4 };

/** Everything in one screen: the Floor card (when shown) and the Chat card with its Agent rail. */
export function Workspace({ mode }: { mode: "floor" | "chat" }) {
  const snap = useOffice();
  const office = snap.office;
  const [showFloor, setShowFloor] = useState(false);
  const [railWide, setRailWide] = useState<Record<string, boolean>>(() => readRail());
  const wide = railWide[mode] ?? mode === "chat";
  const toggleRail = () => setRailWide((current) => { const next = { ...current, [mode]: !wide }; writeRail(next); return next; });
  const paneId = snap.paneId;
  // Chat first: if nothing is selected, open the Agent that has waited longest, else the first one.
  useEffect(() => {
    if (!office || (paneId && office.agents.some((agent) => agent.paneId === paneId))) return;
    const first = [...office.agents].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.waitingSince ?? 0) - (b.waitingSince ?? 0))[0];
    if (first) selectPane(first.paneId);
  }, [office, paneId]);
  if (!office) return null;
  if (mode === "chat") return <ConversationPane office={office} paneId={paneId} />;
  return (
    <div className={`workspace${showFloor ? " show-floor" : ""}`}>
      <FloorCard office={office} />
      <section className={wide ? "card chat-card wide-rail" : "card chat-card"} aria-label="Agents and Conversation">
        <ProjectRail office={office} mode="floor" wide={wide} onToggle={toggleRail} onFloorToggle={() => setShowFloor((value) => !value)} />
        {paneId ? (
          <ChatPanel paneId={paneId} />
        ) : (
          <div className="conv"><div className="empty"><h2>No Agents yet</h2><p>Start one from a team on the left.</p></div></div>
        )}
      </section>
    </div>
  );
}

/** Whether a media query matches, kept in sync with the window. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => { const list = window.matchMedia(query); list.addEventListener("change", notify); return () => list.removeEventListener("change", notify); },
    () => window.matchMedia(query).matches,
  );
}

function ConversationPane({ office, paneId }: { office: OfficeState; paneId: string | null }) {
  const [details, setDetails] = useState(readDetails);
  const toggleDetails = () => setDetails((open) => { const next = !open; writeDetails(next); return next; });
  const closeDetails = () => { setDetails(false); writeDetails(false); };
  // Below 1280 px the details become a drawer: a Radix dialog (focus trap, Esc, backdrop) instead of a column.
  const narrow = useMediaQuery("(max-width: 1279px)");
  return (
    <div className="workspace chat-only">
      <section className={`card convo-card${details ? " details-open" : ""}`} aria-label="Conversation">
        <ProjectRail office={office} mode="chat" wide />
        {paneId ? <ChatPanel paneId={paneId} onShowFloor={() => go({ name: "home" })} detailsOpen={details} onDetails={toggleDetails} /> : <div className="conv"><div className="empty"><h2>No Agents yet</h2></div></div>}
        {paneId && !narrow ? <ContextPanel paneId={paneId} onOpenFile={(path) => openFileHook.current(path)} /> : null}
        {paneId && narrow && details ? (
          <Modal onClose={closeDetails} overlayClass="drawer-overlay">
            <div className="drawer-panel">
              <ModalTitle className="sr-only">Details</ModalTitle>
              <ContextPanel paneId={paneId} onOpenFile={(path) => { closeDetails(); openFileHook.current(path); }} />
            </div>
          </Modal>
        ) : null}
      </section>
    </div>
  );
}

function FloorCard({ office }: { office: OfficeState }) {
  const snap = useOffice();
  return (
    <section className="card floor-card" aria-label="Floor">
      <header className="card-head">
        <span className="card-title">Floor</span>
        <span className="meta floor-stats">
          <span><b>{office.projects.length}</b> teams</span>
          <span><b>{office.agents.length}</b> agents</span>
          <span title={office.kpi.doneToday.map((team) => `${team.label} ${team.count}`).join(", ") || "No finishes yet"}><b>{office.kpi.doneToday.reduce((sum, team) => sum + team.count, 0)}</b> done today</span>
        </span>
        <span className="grow" />
        <span className="hint"><kbd>WASD</kbd> walk · <kbd>wheel</kbd> zoom · <kbd>n</kbd> next</span>
      </header>
      <div className="floor-host">
        <FloorBoundary>
          <FloorPane office={office} />
        </FloorBoundary>
      </div>
      <footer className="card-foot">
        <div className="ticker" role="log" aria-label="Activity">
          {snap.activity.slice(0, 3).map((entry) => (
            <span key={entry.id}><time>{clock(entry.at)}</time>{entry.text}</span>
          ))}
          {snap.activity.length ? null : <span className="task">Nothing happened yet.</span>}
        </div>
        <div className="legend">
          {(["blocked", "working", "done", "idle"] as const).map((status) => (
            <span key={status}><i className="dot" style={{ "--c": statusColor(status) } as CSSProperties} />{status === "blocked" ? "needs you" : status}</span>
          ))}
        </div>
      </footer>
    </section>
  );
}

function nudgeText(): string {
  try {
    return localStorage.getItem("easy-job-nudge") || "continue";
  } catch {
    return "continue";
  }
}

function hurryText(): string {
  try {
    return localStorage.getItem("easy-job-hurry") || HURRY;
  } catch {
    return HURRY;
  }
}

/** The pixel Floor, fed from the office state; work actions go to the bridge, gags stay inside the Floor. */
function FloorPane({ office }: { office: OfficeState }) {
  const snap = useOffice();
  const fuel = useFuel();
  const selected = office.agents.find((agent) => agent.paneId === snap.paneId)?.agentKey ?? null;
  const settings = useMemo<FloorSettings>(() => ({
    theme: snap.theme,
    calm: snap.calm,
    nudgeText: nudgeText(),
    hurryText: hurryText(),
    muted: snap.muted || snap.calm,
    doneToday: Object.fromEntries(office.kpi.doneToday.map((entry) => [entry.workspaceId, entry.count])),
    fuel: Object.fromEntries(office.agents.flatMap((agent) => {
      const left = fuel[agent.paneId]?.windows[0]?.left;
      return left === undefined ? [] : [[agent.agentKey, left]];
    })),
  }), [snap.muted, snap.theme, snap.calm, office.kpi, office.agents, fuel]);
  const paneOf = useCallback((key: string) => office.agents.find((agent) => agent.agentKey === key)?.paneId, [office.agents]);
  const onSelectAgent = useCallback((key: string) => {
    const paneId = paneOf(key);
    if (paneId) selectPane(paneId);
  }, [paneOf]);
  const onSelectProject = useCallback((projectId: string) => selectProject(projectId.split("::")[0] ?? projectId), []);
  const onAction = useCallback(async (kind: WorkAction, target: string, payload?: Record<string, string>) => {
    if (kind === "megaphone") {
      await api(`/api/projects/${encodeURIComponent(target)}/broadcast`, { method: "POST", body: JSON.stringify({ text: payload?.text ?? "" }) });
      return;
    }
    const paneId = paneOf(target);
    if (!paneId) return;
    const path = `/api/agents/${encodeURIComponent(paneId)}`;
    if (kind === "tap") selectPane(paneId);
    if (kind === "knock" || kind === "whip") {
      await api(`${path}/prompt`, { method: "POST", body: JSON.stringify({ text: payload?.text ?? (kind === "whip" ? hurryText() : nudgeText()) }) });
      markSent(paneId);
    }
    if (kind === "bonk") {
      await api(`${path}/interrupt`, { method: "POST" });
      markSent(paneId);
    }
  }, [paneOf]);
  return (
    <FloorView
      office={office}
      selectedAgentKey={selected}
      selectedProjectId={snap.projectId === "all" ? null : snap.projectId}
      settings={settings}
      onSelectAgent={onSelectAgent}
      onSelectProject={onSelectProject}
      onAction={onAction}
    />
  );
}

class FloorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <div className="empty"><h2>The Floor could not load</h2><p>The chat still works.</p></div>;
    return this.props.children;
  }
}
