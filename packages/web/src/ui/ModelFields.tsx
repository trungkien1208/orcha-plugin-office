import { useEffect, useState } from "react";
import { useModelCatalogQuery } from "../queries.ts";
import type { ModelCatalog, ModelOption, ModelSettings } from "@easy-job/shared";
import { listModels } from "../api-accounts.ts";
import { ChoicePicker } from "./ChoicePicker.tsx";

const EFFORT_DESCRIPTION: Record<string, string> = {
  none: "Without extra reasoning",
  minimal: "Light reasoning for quick tasks",
  low: "Quick responses for straightforward tasks",
  medium: "A balance of speed and depth",
  high: "Deeper reasoning for complex work",
  xhigh: "More depth for difficult problems",
  max: "Maximum depth for demanding work",
  ultra: "Deep reasoning with automatic delegation",
};
export const modelChoices = (models: ModelOption[]) =>
  models.map((m) => ({
    value: m.id,
    label: m.name,
    description: m.description,
    detail: [`${m.efforts.length} effort levels`, ...(m.fast ? ["Fast available"] : [])].join(" · "),
  }));

export function useModelCatalog(kind: string) {
  const query = useModelCatalogQuery(kind);
  return { catalog: query.data, loading: query.isPending, refresh: () => void query.refetch() };
}

export function selectedModel(models: ModelOption[], id: string) {
  return models.find((m) => m.id === id || m.aliases?.includes(id) || m.variants?.some((v) => v.model === id));
}

export const effortLabel = (effort: string) =>
  effort === "xhigh" ? "Extra high" : (effort[0]?.toUpperCase() ?? "") + effort.slice(1);
export const effortHint = (effort: string) => EFFORT_DESCRIPTION[effort];

/** Whether Fast exists for this model at the chosen (or default) effort. */
export function fastAllowed(option: ModelOption | undefined, value: ModelSettings): boolean {
  if (!option) return false;
  // Orcha's `fast_efforts`: Fast exists only at some efforts.
  if (option.fastEfforts) return option.fast && option.fastEfforts.includes(value.effort ?? option.defaultEffort ?? "");
  if (!option.variants) return option.fast;
  const effort = value.effort ?? option.variants.find((v) => v.model === value.model)?.effort ?? option.defaultEffort;
  return option.variants.some((v) => v.fast && v.effort === effort);
}

/** Effort as a row of choices and Fast as a switch: no dropdown, every option visible at once. */
export function EffortSpeed({
  option,
  value,
  disabled,
  onChange,
}: {
  option?: ModelOption;
  value: ModelSettings;
  disabled?: boolean;
  onChange: (settings: ModelSettings) => void;
}) {
  const fastAvailable = fastAllowed(option, value);
  const setEffort = (next: string) => {
    const effort = next || undefined;
    onChange({ ...value, effort, fast: fastAllowed(option, { ...value, effort }) ? value.fast : undefined });
  };
  return (
    <>
      {option?.efforts.length ? (
        <fieldset className="launch-segment">
          <legend>Reasoning effort</legend>
          <div className="segmented">
            {["", ...option.efforts].map((effort) => (
              <label key={effort || "default"} title={effort ? EFFORT_DESCRIPTION[effort] : `Agent default${option.defaultEffort ? ` (${option.defaultEffort})` : ""}`}>
                <input type="radio" name="launch-effort" checked={(value.effort ?? "") === effort} disabled={disabled} onChange={() => setEffort(effort)} />
                {effort ? effortLabel(effort) : "Default"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {fastAvailable ? (
        <div className="launch-fast">
          <span><b>Fast mode</b><small>Faster output, may use more of the plan</small></span>
          <button type="button" role="switch" aria-label="Fast mode" aria-checked={value.fast === true} aria-disabled={disabled || undefined} className="fast-switch"
            onClick={() => { if (!disabled) onChange({ ...value, fast: value.fast !== true }); }}>
            <span className="fast-switch-track" aria-hidden="true"><span /></span>
          </button>
        </div>
      ) : null}
    </>
  );
}

export function ModelFields({
  kind,
  value,
  onChange,
}: {
  kind: string;
  value: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}) {
  const { catalog, loading, refresh } = useModelCatalog(kind);
  const [custom, setCustom] = useState(false);
  const option = selectedModel(catalog?.models ?? [], value.model);
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing Agent kind resets the custom input mode
  useEffect(() => setCustom(false), [kind]);
  return (
    <div className="launch-model-fields">
      <div className="launch-model-label">Model</div>
      <ChoicePicker
        label="Model"
        searchable
        value={custom ? "other" : value.model}
        placeholder="Choose model"
        options={[
          { value: "", label: "Agent default" },
          ...modelChoices(catalog?.models ?? []),
          { value: "other", label: "Custom model…", description: "Enter a model ID manually" },
        ]}
        onChange={(model) => {
          setCustom(model === "other");
          onChange({ model: model === "other" ? "" : model });
        }}
      />
      {custom ? (
        <label>
          Custom model{" "}
          <input
            aria-label="Custom launch model"
            value={value.model}
            maxLength={80}
            onChange={(event) => onChange({ model: event.target.value })}
          />
        </label>
      ) : null}
      <EffortSpeed option={option} value={value} onChange={onChange} />
      {loading ? <small role="status">Loading available models…</small> : null}
      {catalog?.error ? (
        <small role="status">
          {catalog.error}{" "}
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </small>
      ) : null}
    </div>
  );
}
