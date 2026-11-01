import { Command } from "cmdk";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { modelName, statusColor, statusText } from "../format.ts";
import { go, selectPane, selectProject } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { Modal, ModalTitle } from "./Modal.tsx";

type Hit = { id: string; label: string; sub: string; color: string; status?: string; run: () => void };

/** ⌘K / Ctrl+K: jump to any Agent or Project by typing, like Orcha's and Claude's switchers. */
export function QuickSwitch() {
  const snap = useOffice();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const office = snap.office;
  if (!open || !office) return null;
  const chat = snap.route.name === "conversation";
  const all: Hit[] = [
    ...office.agents.map((agent) => {
      const project = office.projects.find((item) => item.workspaceId === agent.workspaceId);
      return {
        id: agent.paneId,
        label: agent.name,
        sub: `${project?.label ?? ""} · ${modelName(agent.model, agent.kind)}${agent.task ? ` · ${agent.task}` : ""}`,
        color: project?.projectColor ?? "#888",
        status: agent.status,
        run: () => { selectPane(agent.paneId); if (chat) go({ name: "conversation", paneId: agent.paneId }); },
      };
    }),
    ...office.projects.map((project) => ({
      id: project.workspaceId,
      label: project.label,
      sub: `Project · ${office.agents.filter((agent) => agent.workspaceId === project.workspaceId).length} agents · show bench on Floor`,
      color: project.projectColor,
      run: () => { selectProject(project.workspaceId); go({ name: "home" }); },
    })),
  ];
  const choose = (hit: Hit) => { hit.run(); setOpen(false); };
  return (
    <Modal onClose={() => setOpen(false)} overlayClass="dialog quick" initialFocus=".quick-input">
      <div className="panel">
        <ModalTitle className="sr-only">Jump to an agent or project</ModalTitle>
        {/* cmdk filters and ranks (fuzzy, best match first) and drives ↑↓/Enter. */}
        <Command label="Jump to an agent or project" className="quick-cmd">
          <Command.Input className="quick-input" placeholder="Jump to an agent or project…" aria-label="Search agents and projects" />
          <Command.List className="quick-list">
            <Command.Empty className="notice">Nothing matches.</Command.Empty>
            {all.map((hit) => (
              <Command.Item key={hit.id} value={hit.id} keywords={[hit.label, hit.sub]} onSelect={() => choose(hit)}>
                <i className="quick-swatch" style={{ "--pc": hit.color } as CSSProperties} />
                <span className="quick-label">{hit.label}</span>
                <span className="quick-sub">{hit.sub}</span>
                {hit.status ? <span className="quick-status" style={{ "--c": statusColor(hit.status as never) } as CSSProperties}>{statusText(hit.status as never)}</span> : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
        <p className="quick-hint">↑↓ to move · Enter to open · Esc to close</p>
      </div>
    </Modal>
  );
}
