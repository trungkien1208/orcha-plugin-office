import { useRef } from "react";
import type { Agent, CurrentModelState } from "@easy-job/shared";
import { useModelState } from "../queries.ts";

/** The model the Agent reports. Slow when nothing is changing; fast while a requested change waits to show up. */
export function useCurrentModel(agent: Agent, eager = false) {
  const query = useModelState(agent.paneId, agent.agentKey, eager);
  // Keep the last observation that named a model; a read without one is not "no model".
  const last = useRef<CurrentModelState | undefined>(undefined);
  const next = query.data;
  if (next && next.agentKey === agent.agentKey && next.paneId === agent.paneId && (next.model || last.current?.agentKey !== next.agentKey)) last.current = next;
  const state = last.current;
  const current: CurrentModelState =
    state?.agentKey === agent.agentKey && state.paneId === agent.paneId
      ? state
      : { paneId: agent.paneId, agentKey: agent.agentKey, model: agent.model, source: agent.model ? "orcha" : "unavailable", observedAt: 0 };
  return { current, loading: query.isPending };
}
