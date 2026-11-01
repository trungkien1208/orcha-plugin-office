import type { AgentInfo, PaneInfo, SessionSnapshot, WorkspaceInfo } from "@easy-job/shared";

/** One record change from `session.snapshot { since }` or a `session_changed` event (protocol 23). */
export type SessionChange = {
  entity: "workspace" | "tab" | "pane" | "agent";
  op: "added" | "updated" | "removed";
  id: string;
  record?: Record<string, unknown>;
};

function upsert<T>(list: T[], id: string, key: (item: T) => string, change: SessionChange): T[] {
  const rest = list.filter((item) => key(item) !== id);
  if (change.op === "removed" || !change.record) return rest;
  const index = list.findIndex((item) => key(item) === id);
  const next = change.record as T;
  if (index < 0) return [...rest, next];
  return [...list.slice(0, index), next, ...list.slice(index + 1)];
}

/**
 * The snapshot with changes applied in order. Records are whole (as in the snapshot), so an update replaces the
 * record. Tabs are not part of the snapshot this app keeps, so tab changes are ignored.
 */
export function applyChanges(snapshot: SessionSnapshot, changes: SessionChange[]): SessionSnapshot {
  let { workspaces, panes, agents } = snapshot;
  for (const change of changes) {
    if (change.entity === "workspace") workspaces = upsert<WorkspaceInfo>(workspaces, change.id, (item) => item.workspace_id, change);
    else if (change.entity === "pane") panes = upsert<PaneInfo>(panes, change.id, (item) => item.pane_id, change);
    else if (change.entity === "agent") agents = upsert<AgentInfo>(agents, change.id, (item) => item.pane_id, change);
  }
  return { ...snapshot, workspaces, panes, agents };
}
