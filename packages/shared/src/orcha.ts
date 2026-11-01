/** Subset of the Orcha socket shapes this app actually reads. Extra fields are ignored. */

export type OrchaStatus = "idle" | "working" | "blocked" | "done" | "unknown";

export type AgentSessionInfo = {
  source: string;
  agent: string;
  kind: string;
  value: string;
  /** Protocol 23: the agent's own session id, and its transcript file when the agent's hook reported one. */
  id?: string;
  transcript_path?: string;
};

export type WorkspaceInfo = {
  workspace_id: string;
  number: number;
  label: string;
  focused: boolean;
  pane_count: number;
  tab_count: number;
  active_tab_id: string;
  agent_status: OrchaStatus;
  tokens?: Record<string, string>;
};

export type PaneInfo = {
  pane_id: string;
  workspace_id: string;
  tab_id: string;
  cwd?: string;
  agent?: string;
  agent_status: OrchaStatus;
  terminal_title_stripped?: string;
};

export type AgentInfo = {
  pane_id: string;
  terminal_id?: string;
  workspace_id: string;
  tab_id: string;
  name?: string;
  agent?: string;
  display_agent?: string;
  agent_status: OrchaStatus;
  terminal_title_stripped?: string;
  tokens?: Record<string, string>;
  agent_session?: AgentSessionInfo;
  interactive_ready?: boolean;
  launch_pending?: boolean;
  state_change_seq?: number;
  completion_seq?: number;
  cwd?: string;
  focused?: boolean;
  /** Protocol 23: from the agent's session-start hook; null when Orcha does not know. */
  model?: string | null;
  effort?: string | null;
  fast?: boolean | null;
  /** Protocol 24: finer than the status (`thinking`, `running_tool` + `tool`, `waiting`, `done`), and what was seen. */
  stage?: string | null;
  tool?: string | null;
  seen_seq?: number;
};

export type SessionSnapshot = {
  version?: string;
  protocol?: number;
  focused_workspace_id?: string;
  focused_tab_id?: string;
  focused_pane_id?: string;
  workspaces: WorkspaceInfo[];
  panes: PaneInfo[];
  agents: AgentInfo[];
  /** Protocol 23: grows with every record change; pass back with the epoch to `session.snapshot { since }`. */
  session_version?: number;
  session_epoch?: string;
};

export type OrchaErrorBody = {
  code: string;
  message: string;
};

/** One NDJSON line from a subscription or a request. */
export type OrchaLine = {
  id?: string;
  result?: {
    type?: string;
    snapshot?: SessionSnapshot;
  };
  error?: OrchaErrorBody;
  event?: string;
  data?: {
    type?: string;
    pane_id?: string;
    agent_status?: OrchaStatus;
    workspace_id?: string;
  };
};

export const LIFECYCLE_SUBSCRIPTIONS = [
  "workspace.created",
  "workspace.updated",
  "workspace.metadata_updated",
  "workspace.renamed",
  "workspace.moved",
  "workspace.reordered",
  "workspace.closed",
  "workspace.focused",
  "tab.created",
  "tab.closed",
  "tab.focused",
  "tab.renamed",
  "tab.moved",
  "pane.created",
  "pane.closed",
  "pane.updated",
  "pane.focused",
  "pane.moved",
  "pane.exited",
  "pane.agent_detected",
  "layout.updated",
] as const;
