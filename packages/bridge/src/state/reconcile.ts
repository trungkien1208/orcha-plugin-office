import { agentKeyOf, assignFloor, fallbackCatalog, modelFamily, officeCapabilities, protocolWarning, savedToLayout, stageStep, type SkinCatalog } from "@easy-job/shared";
import type { Agent, LocalState, OfficeState, Project, Status } from "@easy-job/shared";
import type { AgentInfo, PaneInfo, SessionSnapshot, WorkspaceInfo } from "@easy-job/shared";

const STATUS_RANK: Record<Status, number> = {
  blocked: 0,
  done: 1,
  working: 2,
  idle: 3,
  unknown: 4,
};

/** Same hash as the style guide: `h * 31 + charCode`, modulo 360. */
/** Protocol 24's stage as the words the office shows: "running Bash", "thinking", "waiting". */
function orchaStage(agent: { stage?: string | null; tool?: string | null }): string | undefined {
  if (!agent.stage) return undefined;
  if (agent.stage === "running_tool") return agent.tool ? `running ${agent.tool}` : "running a tool";
  return agent.stage;
}

export function hashHue(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function projectColor(label: string): string {
  return `hsl(${hashHue(label)} 60% 58%)`;
}

export function skinForPane(agentKey: string, override: string | undefined, catalog: SkinCatalog): string {
  const known = catalog.skins.some((skin) => skin.id === override) || catalog.cast.includes(override ?? "");
  if (override && known) return override;
  const cast = catalog.cast.length ? catalog.cast : fallbackCatalog().cast;
  return cast[hashHue(agentKey) % cast.length] ?? "headset";
}

/** Nerd Font private-use glyphs, then trim. */
export function stripLabel(label: string): string {
  return label
    .replace(/[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}]/gu, "")
    .trim();
}

export function statusLabel(status: Status): string {
  return status === "blocked" ? "needs me" : status;
}

/** Needs me, then Done, then working, then idle, then unknown. Longest wait first. */
export function compareAgents(a: Agent, b: Agent): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  const waitA = a.waitingSince ?? Number.POSITIVE_INFINITY;
  const waitB = b.waitingSince ?? Number.POSITIVE_INFINITY;
  if (waitA !== waitB) return waitA - waitB;
  return a.paneId < b.paneId ? -1 : a.paneId > b.paneId ? 1 : 0;
}

function projectCwd(workspaceId: string, panes: PaneInfo[], agents: AgentInfo[]): string | undefined {
  return (
    agents.find((agent) => agent.workspace_id === workspaceId && agent.cwd)?.cwd ??
    panes.find((pane) => pane.workspace_id === workspaceId && pane.cwd)?.cwd
  );
}

function toProject(workspace: WorkspaceInfo, panes: PaneInfo[], agents: AgentInfo[]): Project {
  const agentPanes = new Set(
    agents.filter((agent) => agent.workspace_id === workspace.workspace_id).map((agent) => agent.pane_id),
  );
  const label = stripLabel(workspace.label);
  return {
    workspaceId: workspace.workspace_id,
    number: workspace.number,
    label,
    projectColor: projectColor(label),
    terminalCount: panes.filter(
      (pane) => pane.workspace_id === workspace.workspace_id && !agentPanes.has(pane.pane_id),
    ).length,
    cwd: projectCwd(workspace.workspace_id, panes, agents),
  };
}

function officeStatus(agent: AgentInfo, seen: Record<string, number>): Status {
  const status = agent.agent_status;
  const mark = seen[agentKeyOf(agent)];
  if (
    status === "done" &&
    agent.completion_seq != null &&
    mark != null &&
    agent.completion_seq <= mark
  ) {
    return "idle";
  }
  return status;
}

function toAgent(agent: AgentInfo, local: LocalState, now: number, catalog: SkinCatalog): Agent {
  const status = officeStatus(agent, local.seen);
  const key = agentKeyOf(agent);
  const skin = skinForPane(key, local.skins[key], catalog);
  const skinName = catalog.skins.find((item) => item.id === skin)?.name ?? skin;
  const waitingSince = status === "blocked" ? (local.waitingSince[key] ?? now) : undefined;
  return {
    paneId: agent.pane_id,
    agentKey: key,
    workspaceId: agent.workspace_id,
    tabId: agent.tab_id,
    kind: agent.agent ?? "unknown",
    displayAgent: agent.display_agent,
    name: agent.name?.trim() || skinName,
    task: agent.tokens?.task ?? agent.terminal_title_stripped,
    stage: orchaStage(agent) ?? agent.tokens?.stage,
    stageStep: stageStep(orchaStage(agent) ?? agent.tokens?.stage),
    model: agent.model ?? agent.tokens?.model,
    effort: agent.effort ?? undefined,
    fast: agent.fast ?? undefined,
    modelFamily: modelFamily(agent.model ?? agent.tokens?.model, agent.agent),
    status,
    orchaStatus: agent.agent_status,
    completionSeq: agent.completion_seq,
    stateChangeSeq: agent.state_change_seq ?? 0,
    waitingSince,
    skin,
    cwd: agent.cwd,
    session: agent.agent_session,
    interactiveReady: agent.interactive_ready === true,
    launchPending: agent.launch_pending === true,
    focused: agent.focused === true,
    lowFuel: false,
  };
}

export function reconcile(
  snapshot: SessionSnapshot,
  local: LocalState,
  now: number,
  socketPath: string,
  catalog: SkinCatalog = fallbackCatalog(),
): OfficeState {
  const projects = [...snapshot.workspaces]
    .sort((a, b) => a.number - b.number)
    .map((workspace) => toProject(workspace, snapshot.panes, snapshot.agents));
  const agents = snapshot.agents
    .map((agent) => toAgent(agent, local, now, catalog))
    .sort(compareAgents);
  return {
    orcha: {
      connected: true,
      socketPath,
      version: snapshot.version,
      protocol: snapshot.protocol,
      protocolWarning: protocolWarning(snapshot.protocol),
    },
    projects,
    agents,
    counts: {
      needsMe: agents.filter((agent) => agent.status === "blocked").length,
      done: agents.filter((agent) => agent.status === "done").length,
      working: agents.filter((agent) => agent.status === "working").length,
      projects: projects.length,
    },
    kpi: { doneToday: [] },
    capabilities: officeCapabilities(false),
    focused: {
      workspaceId: snapshot.focused_workspace_id,
      tabId: snapshot.focused_tab_id,
      paneId: snapshot.focused_pane_id,
    },
    floor: assignFloor(
      projects.map((project) => ({ workspaceId: project.workspaceId })),
      agents.map((agent) => ({ paneId: agent.paneId, workspaceId: agent.workspaceId, agentKey: agent.agentKey })),
      savedToLayout(
        local.floor,
        agents.map((agent) => ({ agentKey: agent.agentKey, workspaceId: agent.workspaceId })),
      ),
    ),
    catalog,
    updatedAt: now,
  };
}

/** Copy Needs-me first-seen times out of a reconciled state so the next refresh keeps them. */
export function rememberWaiting(local: LocalState, state: OfficeState): LocalState {
  const waitingSince: Record<string, number> = {};
  for (const agent of state.agents) {
    if (agent.status === "blocked" && agent.waitingSince != null) {
      waitingSince[agent.agentKey] = agent.waitingSince;
    }
  }
  return { ...local, waitingSince };
}
