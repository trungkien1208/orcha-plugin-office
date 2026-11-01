import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { FormEvent, ReactNode } from "react";
import type { ModelSettings, Project } from "@easy-job/shared";
import { api } from "../api.ts";
import { selectProject } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { KindIcon } from "../ui/Header.tsx";
import { ChoicePicker } from "../ui/ChoicePicker.tsx";
import { ModelFields } from "../ui/ModelFields.tsx";
import "./launch.css";
import { suggestNames } from "./names.ts";
import { Modal, ModalTitle } from "../ui/Modal.tsx";

const KIND_LABEL: Record<string, string> = { claude: "Claude", codex: "Codex", cursor: "Cursor" };

function useKinds() {
  const [kinds, setKinds] = useState<string[]>(["claude", "codex"]);
  useEffect(() => { void api<string[]>("/api/kinds").then((list) => { if (list.length) setKinds(list); }).catch(() => undefined); }, []);
  return kinds;
}

/** The dialog frame for both launchers: Esc or the backdrop closes, ⌘↵ submits. */
function Launcher({ title, subtitle, busy, submitLabel, canSubmit, error, onSubmit, close, children }: {
  title: string; subtitle: ReactNode; busy: boolean; submitLabel: string; canSubmit: boolean; error: string | null; onSubmit: () => void; close: () => void; children: ReactNode;
}) {
  const submit = (event?: FormEvent) => { event?.preventDefault(); if (canSubmit && !busy) onSubmit(); };
  return (
    <Modal onClose={() => { if (!busy) close(); }} overlayClass="dialog launch-backdrop" initialFocus="[data-autofocus]">
      <form className="panel launch" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(); }}>
        <header className="launch-head">
          <ModalTitle>{title}</ModalTitle>
          <p>{subtitle}</p>
        </header>
        <div className="launch-body">{children}</div>
        {error ? <p className="err launch-error">{error}</p> : null}
        <footer className="launch-foot">
          <small>⌘↵ to start · Esc to cancel</small>
          <button className="btn ghost" type="button" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!canSubmit || busy}>{busy ? "Starting…" : submitLabel}</button>
        </footer>
      </form>
    </Modal>
  );
}

/** Kind, the first prompt, then the rarely-changed options folded away. */
function AgentFields({ kinds, kind, onKind, prompt, onPrompt, model, onModel, name, onName, onShuffle, autoFocus }: {
  kinds: string[]; kind: string; onKind: (kind: string) => void; prompt: string; onPrompt: (text: string) => void;
  model: ModelSettings; onModel: (model: ModelSettings) => void; name: string; onName: (name: string) => void; onShuffle: () => void; autoFocus?: boolean;
}) {
  return (
    <>
      <fieldset className="kind-cards">
        <legend>Agent</legend>
        {kinds.map((item) => (
          <label key={item} className={kind === item ? "on" : undefined}>
            <input type="radio" name="launch-kind" checked={kind === item} onChange={() => { onKind(item); onModel({ model: "" }); }} />
            <KindIcon kind={item} model={item === "claude" ? "opus" : item} />
            <span>{KIND_LABEL[item] ?? item}</span>
          </label>
        ))}
      </fieldset>
      <ModelFields kind={kind} value={model} onChange={onModel} />
      <div className="launch-name">
        <label className="launch-field">Agent name<input value={name} onChange={(event) => onName(event.target.value)} placeholder="Picked for you" /></label>
        <button type="button" className="btn launch-shuffle" title="Another name" aria-label="Another name" onClick={onShuffle}>🎲</button>
      </div>
      <label className="launch-prompt">
        <span>First task <small>optional</small></span>
        <textarea data-autofocus={autoFocus || undefined} value={prompt} onChange={(event) => onPrompt(event.target.value)} placeholder="What should it work on? Leave empty to start idle." rows={4} />
      </label>
      <p className="launch-hint">Starts on Orcha's default account; switch accounts from the chat after it starts.</p>
    </>
  );
}

const agentBody = (kind: string, prompt: string, model: ModelSettings, name?: string) => ({
  kind,
  name: name?.trim() || undefined,
  prompt: prompt.trim() || undefined,
  ...model,
  model: model.model.trim() || undefined,
});

export function NewAgent({ projects, initial, close }: { projects: Project[]; initial: string; close: () => void }) {
  const snap = useOffice();
  const kinds = useKinds();
  const [workspaceId, setWorkspaceId] = useState(initial);
  const [kind, setKind] = useState("claude");
  // A free name from the cast is filled in; 🎲 offers the next one.
  const [skip, setSkip] = useState(0);
  const [name, setName] = useState(() => suggestNames(snap.office)[0] ?? "");
  const shuffle = () => { const next = skip + 1; setSkip(next); setName(suggestNames(snap.office, 1, next)[0] ?? ""); };
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelSettings>({ model: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = () => {
    setBusy(true); setError(null);
    void api(`/api/projects/${encodeURIComponent(workspaceId)}/agents`, { method: "POST", body: JSON.stringify(agentBody(kind, prompt, model, name)) })
      .then(() => { toast.success("Starting the agent", { description: "It appears on the Floor when Orcha reports it." }); close(); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not start"))
      .finally(() => setBusy(false));
  };
  return (
    <Launcher title="New agent" busy={busy} submitLabel="Start agent" canSubmit={!!workspaceId} error={error} onSubmit={start} close={close}
      subtitle="Opens a new Orcha tab; your focus stays here.">
      <div className="launch-field">
        <span>Project</span>
        <ChoicePicker label="Project" searchable value={workspaceId} placeholder="Choose a project" onChange={setWorkspaceId}
          options={projects.map((project) => ({ value: project.workspaceId, label: project.label, description: project.cwd }))} />
      </div>
      <AgentFields kinds={kinds} kind={kind} onKind={setKind} prompt={prompt} onPrompt={setPrompt} model={model} onModel={setModel} name={name} onName={setName} onShuffle={shuffle} autoFocus />
    </Launcher>
  );
}

/** A new Project is a new Orcha workspace in a folder; it gets a Bench at the end of the Floor. */
export function NewProject({ projects, close }: { projects: Project[]; close: () => void }) {
  const parent = (() => {
    const dirs = projects.map((project) => project.cwd?.replace(/\/[^/]+\/?$/, "")).filter((dir): dir is string => !!dir);
    const counts = new Map<string, number>();
    for (const dir of dirs) counts.set(dir, (counts.get(dir) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "~";
  })();
  const snap = useOffice();
  const kinds = useKinds();
  const [skip, setSkip] = useState(0);
  const [name, setName] = useState(() => suggestNames(snap.office)[0] ?? "");
  const shuffle = () => { const next = skip + 1; setSkip(next); setName(suggestNames(snap.office, 1, next)[0] ?? ""); };
  const [cwd, setCwd] = useState(`${parent}/`);
  const [label, setLabel] = useState("");
  const [labelEdited, setLabelEdited] = useState(false);
  const [withAgent, setWithAgent] = useState(true);
  const [kind, setKind] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelSettings>({ model: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const derived = cwd.replace(/\/+$/, "").split("/").pop() ?? "";
  const finalLabel = (labelEdited ? label : derived).trim();
  const create = () => {
    setBusy(true); setError(null);
    void api<{ workspaceId: string }>("/api/projects", { method: "POST", body: JSON.stringify({ label: finalLabel, cwd, agent: withAgent ? agentBody(kind, prompt, model, name) : undefined }) })
      .then(() => { toast.success(`Created ${finalLabel}`); selectProject("all"); close(); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not create the project"))
      .finally(() => setBusy(false));
  };
  return (
    <Launcher title="New project" busy={busy} submitLabel={withAgent ? "Create and start" : "Create project"} canSubmit={!!finalLabel && !!cwd.trim() && cwd.trim() !== "~/"} error={error} onSubmit={create} close={close}
      subtitle="A new Orcha workspace in a folder. It gets a bench at the end of the Floor.">
      <label className="launch-field">Folder<input data-autofocus value={cwd} onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)} onChange={(event) => setCwd(event.target.value)} placeholder="~/Project/my-app" spellCheck={false} /></label>
      <label className="launch-field">Name<input value={labelEdited ? label : derived} onChange={(event) => { setLabel(event.target.value); setLabelEdited(true); }} placeholder="From the folder name" /></label>
      <label className="launch-toggle">
        <input type="checkbox" checked={withAgent} onChange={(event) => setWithAgent(event.target.checked)} />
        <span><b>Start an agent in it</b><small>Same as New agent, right after the workspace opens.</small></span>
      </label>
      {withAgent ? <AgentFields kinds={kinds} kind={kind} onKind={setKind} prompt={prompt} onPrompt={setPrompt} model={model} onModel={setModel} name={name} onName={setName} onShuffle={shuffle} /> : null}
    </Launcher>
  );
}
