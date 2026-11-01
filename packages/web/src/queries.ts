import { QueryClient, useQuery } from "@tanstack/react-query";
import type { CurrentModelState, Fuel, GitContext, ModelCatalog } from "@easy-job/shared";
import { api } from "./api.ts";
import { type AccountInfo, type Feature, listAccounts, listModels, teamThread, type ThreadItem } from "./api-accounts.ts";

/**
 * Everything the shell reads over HTTP goes through TanStack Query: one request per key however many panels ask,
 * refetch on an interval only while the tab is visible, refetch when the window regains focus, one retry.
 * The live office state and conversations still arrive over the WebSocket (store.ts).
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: true } },
});

const pane = (paneId: string) => `/api/agents/${encodeURIComponent(paneId)}`;

export type AgentContext = { git: GitContext | null; fuel: Fuel | null };

/** Fuel for every Agent, by pane. */
export function useFuel(): Record<string, Fuel | null> {
  return useQuery({
    queryKey: ["fuel"],
    queryFn: () => api<{ byPane: Record<string, Fuel | null> }>("/api/fuel").then((result) => result.byPane),
    refetchInterval: 30_000,
    staleTime: 25_000,
  }).data ?? {};
}

/** Git and fuel around one Agent (header, context panel, Changes tab). */
export function useAgentContext(paneId: string | null): AgentContext | null {
  return useQuery({
    queryKey: ["context", paneId],
    queryFn: () => api<AgentContext>(`${pane(paneId ?? "")}/context`),
    enabled: !!paneId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  }).data ?? null;
}

/** The Agent's file list: the Files tab and chat links share it. */
export function useRepoFiles(paneId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["files", paneId],
    queryFn: () => api<string[]>(`${pane(paneId ?? "")}/files`),
    enabled: !!paneId && enabled,
    staleTime: 30_000,
  });
}

/** Accounts; the socket's `accounts` push writes straight into this cache (see store.ts). */
export function useAccountsQuery() {
  return useQuery({ queryKey: ["accounts"], queryFn: listAccounts, staleTime: 30_000 });
}
export const pushAccounts = (accounts: AccountInfo[]) => {
  const value: Feature<AccountInfo[]> = { available: true, data: accounts };
  queryClient.setQueryData(["accounts"], value);
};

/** The model an Agent reports: slow when nothing is changing, fast while a requested change waits to show up. */
export function useModelState(paneId: string, agentKey: string, eager: boolean) {
  return useQuery({
    queryKey: ["model-state", paneId, agentKey],
    queryFn: () => api<CurrentModelState>(`${pane(paneId)}/model-state`),
    refetchInterval: eager ? 2_000 : 10_000,
    staleTime: 1_000,
  });
}

/** The model catalog for an agent kind; it changes rarely. */
export function useModelCatalogQuery(kind: string) {
  return useQuery({
    queryKey: ["models", kind],
    queryFn: async (): Promise<ModelCatalog> => {
      const result = await listModels(kind);
      return result.available ? result.data : { kind, models: [], source: "", fetchedAt: "", error: result.reason };
    },
    staleTime: 5 * 60_000,
  });
}

/** The newest page of a Project's Team thread, polled while someone looks at it. */
export function useTeamThread(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["team", workspaceId],
    queryFn: async (): Promise<Feature<{ items: ThreadItem[] }>> => teamThread(workspaceId ?? ""),
    enabled: !!workspaceId && enabled,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}
