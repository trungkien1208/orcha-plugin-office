import type { SessionSnapshot } from "@easy-job/shared";

/** Label of the workspace `easy-job open --via-orcha` creates to host the bridge pane. */
export const HOST_WORKSPACE_LABEL = "Easy Job bridge";
/** Workspace token that marks the host workspace. Never match by label: users may name a real Project "Easy Job". */
export const HOST_TOKEN = "easy_job";
export const HOST_TOKEN_VALUE = "bridge";

export function isHostWorkspace(workspace: { tokens?: Record<string, string> }): boolean {
  return workspace.tokens?.[HOST_TOKEN] === HOST_TOKEN_VALUE;
}

/** Drop Easy Job's own host workspace and its bridge pane so they never show on the Floor or in counts. */
export function hideOwn(snapshot: SessionSnapshot, ownPaneId?: string): SessionSnapshot {
  const hidden = new Set(snapshot.workspaces.filter(isHostWorkspace).map((workspace) => workspace.workspace_id));
  if (!hidden.size && !ownPaneId) return snapshot;
  return {
    ...snapshot,
    workspaces: snapshot.workspaces.filter((workspace) => !hidden.has(workspace.workspace_id)),
    panes: snapshot.panes.filter((pane) => !hidden.has(pane.workspace_id) && pane.pane_id !== ownPaneId),
    agents: snapshot.agents.filter((agent) => !hidden.has(agent.workspace_id) && agent.pane_id !== ownPaneId),
  };
}
