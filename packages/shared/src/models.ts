export type ModelSettings = { model: string; effort?: string; fast?: boolean };
export type ModelVariant = { model: string; name?: string; effort?: string; fast: boolean };
export type ModelOption = {
  id: string;
  name: string;
  aliases?: string[];
  description?: string;
  efforts: string[];
  defaultEffort?: string;
  fast: boolean;
  /** Fast exists only for these efforts (Orcha's `fast_efforts`); missing means every effort when `fast`. */
  fastEfforts?: string[];
  variants?: ModelVariant[];
};
export type ModelCatalog = { kind: string; models: ModelOption[]; source: string; fetchedAt: string; error?: string };
export type CurrentModelState = {
  paneId: string;
  agentKey: string;
  model?: string;
  effort?: string;
  fast?: boolean;
  source: "terminal-footer" | "session" | "orcha" | "unavailable";
  observedAt: number;
};
