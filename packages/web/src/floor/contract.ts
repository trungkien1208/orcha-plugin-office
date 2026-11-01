import { emptyOffice } from "@easy-job/shared";
import type { Agent, FloorMemory, OfficeState, Project, Status } from "@easy-job/shared";

export type FloorAgent = Omit<Agent, "skin"> & { skin: string; agentKey?: string; terminalId?: string };
export type FloorOffice = Omit<OfficeState, "agents"> & { agents: FloorAgent[] };
export type WorkAction = "tap" | "knock" | "whip" | "bonk" | "megaphone";
export type FunAction = "buzzer" | "zap" | "coffee" | "high-five";
export type BossAction = WorkAction | FunAction;
export type FloorSettings = {
  nudgeText?: string;
  /** Prompt the whip crack sends: "work faster". */
  hurryText?: string;
  muted?: boolean;
  reducedMotion?: boolean;
  /** "office" swaps in the Cozy Office art (manifest themes.office) and its decor. */
  theme?: "compound" | "office";
  /** Calm mode: reduced motion and no gags in the Boss popup. */
  calm?: boolean;
  doneToday?: Record<string, number>;
  doneSoundUrl?: string;
  /** agentKey → fuel left (0–100) in the account's current window; drawn as an HP bar over the head. */
  fuel?: Record<string, number>;
};
export type FloorCallbacks = {
  onSearch?: () => void;
  onSelectAgent?: (agentKey: string) => void;
  onSelectProject?: (projectId: string) => void;
  onAction?: (kind: WorkAction, target: string, payload?: Record<string, string>) => void | Promise<void>;
};
export type FloorViewProps = FloorCallbacks & {
  office?: FloorOffice;
  selectedAgentKey?: string | null;
  selectedProjectId?: string | null;
  settings?: FloorSettings;
  manifestUrl?: string;
};
export type Person = { key: string; paneId: string; projectId: string; name: string; skin: string; color: string; status: Status; stage?: string; task?: string };
export type FloorInput = {
  office: FloorOffice;
  selected: string | null;
  settings: FloorSettings;
  callbacks: FloorCallbacks;
};
export type NearAgent = { key: string; name: string; projectId: string; status: Status; x: number; y: number };
export type FloorHud = { near: NearAgent | null; zoom: number; ready: boolean; activity?: string };
export function agentKey(agent: FloorAgent): string {
  return agent.agentKey ?? agent.session?.value ?? agent.terminalId ?? agent.paneId;
}
export function peopleOf(office: FloorOffice): Person[] {
  return office.agents.map((agent) => ({ key: agentKey(agent), paneId: agent.paneId, projectId: agent.workspaceId, name: agent.name, skin: agent.skin, color: office.projects.find((p) => p.workspaceId === agent.workspaceId)?.projectColor ?? "#8fa3a0", status: agent.status, stage: agent.stage, task: agent.task }));
}
export type { FloorMemory, Project, Status };
/** Shown until the bridge sends its first state. */
export function emptyFloorOffice(): FloorOffice {
  return emptyOffice("");
}
