import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Agent, Fuel, FuelWindow, ModelOption, ModelSettings } from "@easy-job/shared";
import { changeModel, loginAccount, planSwitch, switchAccount } from "../api-accounts.ts";
import { modelName } from "../format.ts";
import type { AccountInfo, Capabilities, SwitchMode, SwitchPlan } from "../api-accounts.ts";
import { HealthBars } from "../chat/Context.tsx";
import { useOffice } from "../useOffice.ts";
import { AccountBadge, openAccounts, useAccounts } from "./Accounts.tsx";
import { selectCreatedAgent } from "./CreatedAgent.tsx";
import { KindIcon } from "./Header.tsx";
import { effortHint, effortLabel, fastAllowed, selectedModel, useModelCatalog } from "./ModelFields.tsx";
import { useCurrentModel } from "./useCurrentModel.ts";
import "./pills.css";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";

const NO_MODELS: ModelOption[] = [];

/** Account and model for the Agent, under the composer: each pill opens one popover, never a dialog. */
export function AgentPills({ agent, fuel }: { agent: Agent; fuel?: Fuel | null }) {
  return (
    <div className="agent-pills">
      <AccountPill agent={agent} fuel={fuel} />
      <ModelPill key={`${agent.paneId}:${agent.agentKey}`} agent={agent} />
    </div>
  );
}

/** A pill button with a portaled popover that stays inside the viewport (the composer sits at the bottom). */
function Pill({ label, title, className, disabled, face, width, children }: {
  label: string; title?: string; className?: string; disabled?: boolean; face: ReactNode; width: number; children: (close: () => void) => ReactNode;
}) {
  // Radix Popover: placement and flipping, Esc and outside click, focus return to the pill.
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return (
    <Popover.Root open={open} onOpenChange={(next) => setOpen(next && !disabled)}>
      <Popover.Trigger asChild>
        <button type="button" className={`pill${open ? " is-open" : ""}${className ? ` ${className}` : ""}`} aria-label={label} title={title} aria-haspopup="dialog" aria-disabled={disabled || undefined}>
          {face}<span className="pill-chevron" aria-hidden="true">⌄</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pill-panel" side="top" align="start" sideOffset={6} collisionPadding={12} aria-label={label}
          style={{ width: `min(${width}px, calc(100vw - 24px))`, maxHeight: "min(520px, var(--radix-popover-content-available-height))" }}
          onOpenAutoFocus={(event) => {
            const target = (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-autofocus], input, button:not([disabled])");
            if (target) { event.preventDefault(); target.focus({ preventScroll: true }); }
          }}>
          {children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const sameSettings = (a: ModelSettings, b: ModelSettings) => a.model === b.model && a.effort === b.effort && a.fast === b.fast;

function ModelPill({ agent }: { agent: Agent }) {
  const [pending, setPending] = useState<ModelSettings | null>(null);
  const { current, loading: reading } = useCurrentModel(agent, !!pending);
  const { catalog, loading, refresh } = useModelCatalog(agent.kind);
  const models = catalog?.models ?? NO_MODELS;
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestedAt = useRef(0);
  const blocked = agent.status === "blocked";

  // A request stays "pending" until the Agent reports the settings back after it was sent.
  useEffect(() => {
    if (!pending || current.observedAt <= requestedAt.current) return;
    const observed = selectedModel(models, current.model ?? "");
    const sameModel = current.model === pending.model || observed?.id === pending.model;
    if (sameModel && (pending.effort === undefined || current.effort === pending.effort) && (pending.fast === undefined || current.fast === pending.fast)) {
      setPending(null);
      setNote("");
    }
  }, [current.model, current.effort, current.fast, current.observedAt, pending, models]);

  const live: ModelSettings = { model: current.model ?? "", effort: current.effort, fast: current.fast };
  const shown: ModelSettings = pending ? { ...live, ...Object.fromEntries(Object.entries(pending).filter(([, value]) => value !== undefined)) } : live;
  const option = selectedModel(models, shown.model);
  const name = option?.variants?.find((v) => v.model === shown.model)?.name ?? option?.name ?? (shown.model ? modelName(shown.model, agent.kind) : reading ? "Reading…" : "Model");
  const state = failed ? "Failed" : pending ? (note === "Queued until idle" ? "Queued" : "Confirming") : "";

  async function apply(next: ModelSettings) {
    // Only what changed goes to the Agent, so one Apply is one round of slash commands.
    const options = { effort: next.effort !== live.effort ? next.effort : undefined, fast: next.fast !== live.fast ? next.fast : undefined };
    setBusy(true); setFailed(false); setNote("Sending…");
    requestedAt.current = Date.now();
    try {
      const result = await changeModel(agent, next.model, options);
      if (!result.available) throw new Error(result.reason);
      setPending({ model: next.model, ...options });
      setNote(result.data.queued ? "Queued until idle" : "Awaiting confirmation");
    } catch (error) {
      setFailed(true);
      setNote(error instanceof Error ? error.message : "Could not change model");
      toast.error(error instanceof Error ? error.message : "Could not change model");
    } finally {
      setBusy(false);
    }
  }

  const title = [`Model: ${name}`, shown.effort ? `Effort: ${effortLabel(shown.effort)}` : "", shown.fast ? "Fast" : "", note].filter(Boolean).join(" · ");
  return (
    <Pill label={`Model for ${agent.name}`} title={title} className={`model-pill${state ? ` is-${state.toLowerCase()}` : ""}`} disabled={busy} width={340}
      face={<>
        <KindIcon kind={agent.kind} model={shown.model} />
        <span className="pill-text">{name}</span>
        {shown.effort ? <span className="pill-sub">{effortLabel(shown.effort)}</span> : null}
        {shown.fast ? <span className="pill-fast" title="Fast">⚡</span> : null}
        {state ? <span className="pill-state" role="status">{state}</span> : null}
      </>}>
      {(close) => (
        <ModelPanel agent={agent} models={models} start={shown} loading={loading} error={catalog?.error} note={failed ? note : pending ? note : ""} blocked={blocked}
          onRetry={refresh} onApply={(next) => { close(); if (!sameSettings(next, shown)) void apply(next); }} />
      )}
    </Pill>
  );
}

function ModelPanel({ agent, models, start, loading, error, note, blocked, onRetry, onApply }: {
  agent: Agent; models: ModelOption[]; start: ModelSettings; loading: boolean; error?: string; note: string; blocked: boolean; onRetry: () => void; onApply: (next: ModelSettings) => void;
}) {
  const [draft, setDraft] = useState(start);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const customField = useRef<HTMLInputElement>(null);
  useEffect(() => { if (custom) customField.current?.focus(); }, [custom]);
  const option = selectedModel(models, draft.model);
  const known = !draft.model || !!option;
  const changed = !sameSettings(draft, start) && !!draft.model.trim() && /^[\w.:/-]{1,80}$/.test(draft.model.trim());

  const pick = (m: ModelOption) => {
    setCustom(false);
    const effort = draft.effort && m.efforts.includes(draft.effort) ? draft.effort : undefined;
    setDraft({ model: m.id, effort, fast: fastAllowed(m, { model: m.id, effort }) ? draft.fast : undefined });
  };
  const submit = () => { if (changed && !blocked) onApply({ ...draft, model: draft.model.trim() }); };

  return (
    <form className="pill-form" onSubmit={(event) => { event.preventDefault(); submit(); }} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); } }}>
      {/* cmdk filters the models as you type and drives ↑↓/Enter; Enter picks, ⌘↵ applies. */}
      <Command label="Search models" className="pill-cmd" shouldFilter={!!query} filter={(value, search, keywords) => (`${value} ${(keywords ?? []).join(" ")}`.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
        <div className="pill-search">
          <span aria-hidden="true">⌕</span>
          <Command.Input data-autofocus aria-label="Search models" placeholder="Find a model…" value={query} onValueChange={setQuery} />
        </div>
        <Command.List className="pill-list" aria-label="Models">
          {!known && !custom && !query ? (
            <Command.Item value={`reported:${draft.model}`} className="pill-option" aria-label={draft.model} onSelect={() => undefined}>
              <span><b>{draft.model}</b><small>Reported by this Agent</small></span><i aria-hidden="true">✓</i>
            </Command.Item>
          ) : null}
          {models.map((m) => (
            <Command.Item key={m.id} value={m.id} keywords={[m.name, m.description ?? ""]} className="pill-option" aria-label={m.name} data-chosen={(!custom && option?.id === m.id) || undefined} onSelect={() => pick(m)}>
              <span><b>{m.name}</b>{m.description ? <small>{m.description}</small> : null}</span>
              <i aria-hidden="true">{!custom && option?.id === m.id ? "✓" : ""}</i>
            </Command.Item>
          ))}
          {query && models.length ? <Command.Empty className="pill-empty">No models match “{query}”.</Command.Empty> : null}
          {loading ? <p className="pill-empty">Loading models…</p> : null}
          {error ? <p className="pill-empty">{error} <button type="button" className="link" onClick={onRetry}>Retry</button></p> : null}
          <Command.Item value="custom" forceMount className="pill-option" aria-label="Custom model…" data-chosen={custom || undefined} onSelect={() => { setCustom(true); setDraft({ model: "" }); }}>
            <span><b>Custom model…</b><small>Enter a model ID</small></span><i aria-hidden="true">{custom ? "✓" : ""}</i>
          </Command.Item>
        </Command.List>
      </Command>
      {custom ? <input ref={customField} className="pill-custom" aria-label="Custom model name" placeholder="Model ID, e.g. opus" maxLength={80} value={draft.model} onChange={(event) => setDraft({ model: event.target.value })} /> : null}
      {option?.efforts.length ? (
        <fieldset className="pill-field">
          <legend>Reasoning effort</legend>
          <div className="segmented">
            {option.efforts.map((effort) => (
              <label key={effort} title={effortHint(effort)}>
                <input type="radio" name="model-effort" checked={draft.effort === effort}
                  onChange={() => setDraft((value) => ({ ...value, effort, fast: fastAllowed(option, { ...value, effort }) ? value.fast : undefined }))} />
                {effortLabel(effort)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {fastAllowed(option, draft) ? (
        <div className="pill-field pill-row">
          <span><b>Fast mode</b><small>Faster output, may use more of the plan</small></span>
          <button type="button" role="switch" aria-label="Fast mode" aria-checked={draft.fast === true} className="fast-switch" onClick={() => setDraft((value) => ({ ...value, fast: value.fast !== true }))}>
            <span className="fast-switch-track" aria-hidden="true"><span /></span>
          </button>
        </div>
      ) : null}
      <footer className="pill-foot">
        <small role="status">{blocked ? "Answer the question first." : note || (agent.status === "working" ? "Applies when this turn ends." : "Sent as slash commands.")}</small>
        <button type="submit" className="btn primary" disabled={!changed || blocked}>Apply</button>
      </footer>
    </form>
  );
}

function storedMode(): SwitchMode {
  try {
    const mode = localStorage.getItem("easy-job-switch-mode");
    return mode === "keychain" || mode === "handoff" ? mode : "restart";
  } catch {
    return "restart";
  }
}

/** "Claude · work" reads as "work" next to the Claude badge. */
const shortLabel = (account: AccountInfo) => account.label.replace(/^(claude|codex|cursor)\s*·\s*/i, "");
const asFuel = (account: AccountInfo): Fuel => ({ account: account.id, label: account.label, windows: account.fuel });

function AccountPill({ agent, fuel }: { agent: Agent; fuel?: Fuel | null }) {
  const { accounts, note, refresh } = useAccounts();
  const current = accounts.find((a) => a.id === agent.accountId || a.panes.includes(agent.paneId));
  const windows: FuelWindow[] = current?.fuel.length ? current.fuel : fuel?.windows ?? [];
  const title = current ? `Account: ${current.label}${current.email ? ` · ${current.email}` : ""}${windows.length ? ` · ${windows.map((w) => `${w.label} ${w.left}%`).join(" · ")}` : ""}` : "Account not reported";
  return (
    <Pill label={`Switch account for ${agent.name}`} title={title} className="account-pill" width={360}
      face={<>
        <AccountBadge kind={agent.kind} />
        <span className="pill-text">{current ? shortLabel(current) : "Account"}</span>
      </>}>
      {(close) => <AccountPanel agent={agent} accounts={accounts} current={current} loadNote={note} onRefresh={refresh} close={close} />}
    </Pill>
  );
}

function AccountPanel({ agent, accounts, current, loadNote, onRefresh, close }: {
  agent: Agent; accounts: AccountInfo[]; current?: AccountInfo; loadNote: string; onRefresh: () => void; close: () => void;
}) {
  const [target, setTarget] = useState<string>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = accounts.filter((a) => a.kind === agent.kind);
  const login = (account: AccountInfo) => {
    setBusy(true);
    void loginAccount(account.id)
      .then((result) => setNote(result.available ? `Finish signing in to ${shortLabel(account)} in Orcha, then refresh.` : result.reason))
      .catch((error: unknown) => setNote(error instanceof Error ? error.message : "Could not start sign-in"))
      .finally(() => setBusy(false));
  };
  return (
    <div className="pill-form">
      <header className="pill-head">
        <b>Account</b>
        <button type="button" className="link" onClick={onRefresh}>Refresh</button>
      </header>
      {loadNote ? <p className="pill-empty" role="status">{loadNote}</p> : null}
      <div className="pill-list">
        {mine.map((account) => {
          const isCurrent = account.id === current?.id;
          const open = target === account.id;
          return (
            <div key={account.id} className={`acct${isCurrent ? " is-current" : ""}${open ? " is-open" : ""}`}>
              <button type="button" className="acct-main" disabled={isCurrent || !account.signedIn || busy} aria-expanded={isCurrent ? undefined : open}
                onClick={() => setTarget(open ? undefined : account.id)}>
                <AccountBadge kind={account.kind} />
                <span className="acct-copy">
                  <b>{shortLabel(account)}</b>
                  <small>{[account.email, account.plan].filter(Boolean).join(" · ") || (account.signedIn ? "Signed in" : "Signed out")}</small>
                </span>
                {isCurrent ? <span className="acct-tag">Current</span> : account.signedIn ? <span className="acct-tag ghost">{open ? "Cancel" : "Switch"}</span> : null}
              </button>
              {!account.signedIn ? <button type="button" className="btn acct-signin" disabled={busy} onClick={() => login(account)}>Sign in</button> : null}
              {account.fuel.length ? <div className="acct-fuel"><HealthBars fuel={asFuel(account)} /></div> : null}
              {open ? <SwitchInline agent={agent} account={account} close={close} onNote={setNote} /> : null}
            </div>
          );
        })}
        {!mine.length && !loadNote ? <p className="pill-empty">No {agent.kind} accounts found. Add them in Settings → Accounts.</p> : null}
      </div>
      {note ? <p className="pill-note" role="status">{note}</p> : null}
    </div>
  );
}

/** The simple switch, right in the popover. Anything that needs stopping work or moving other Agents opens the full dialog. */
function SwitchInline({ agent, account, close, onNote }: { agent: Agent; account: AccountInfo; close: () => void; onNote: (note: string) => void }) {
  const snap = useOffice();
  const capabilities = (snap.office as typeof snap.office & { capabilities?: Capabilities })?.capabilities;
  const [mode, setMode] = useState<SwitchMode>(() => {
    const stored = storedMode();
    return stored === "keychain" && !capabilities?.accountApi ? "restart" : stored === "handoff" && !capabilities?.handoff ? "restart" : stored;
  });
  const [plan, setPlan] = useState<SwitchPlan>();
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a status change invalidates the dry run
  useEffect(() => {
    let live = true;
    setPlan(undefined); setChecking(true);
    void planSwitch(agent.paneId, account.id, mode)
      .then((result) => { if (live) { if (result.available) setPlan(result.data); else onNote(result.reason); } })
      .catch((error: unknown) => { if (live) onNote(error instanceof Error ? error.message : "Could not check the switch"); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [agent.paneId, agent.status, account.id, mode]);

  const complex = !!plan && (plan.needsIdle || (mode === "keychain" && plan.alsoMoves.length > 0));
  const ready = !!plan && plan.allowed && plan.mode === mode && !complex && plan.sessionLinked !== false && !checking && !sending;
  const confirm = () => {
    if (!ready) return;
    setSending(true);
    try { localStorage.setItem("easy-job-switch-mode", mode); } catch { /* per-browser convenience */ }
    void switchAccount(agent.paneId, account.id, mode)
      .then((result) => {
        if (!result.available) { onNote(result.reason); return; }
        toast.success(`Switching ${agent.name} to ${shortLabel(account)}`, { description: "Waiting for Orcha to restart it." });
        close();
        if (result.data.paneId && result.data.paneId !== agent.paneId) selectCreatedAgent(result.data.paneId);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Switch failed"))
      .finally(() => setSending(false));
  };
  const modes: Array<{ value: SwitchMode; label: string; hint: string; off?: string }> = [
    { value: "restart", label: "Restart and resume", hint: "Stops this Agent, signs in again, resumes the session." },
    { value: "handoff", label: "Hand off", hint: "A new Agent on this account continues from notes.", off: capabilities?.handoff ? undefined : "handoff.py is not installed" },
    { value: "keychain", label: "Keep the conversation", hint: "Swap the login without restarting.", off: capabilities?.accountApi ? undefined : "Needs Orcha's account API" },
  ];
  return (
    <div className="acct-switch">
      <fieldset className="acct-modes">
        <legend className="sr-only">Switch method</legend>
        {modes.map((item) => (
          <label key={item.value} className={item.off ? "is-off" : undefined} title={item.off ?? item.hint}>
            <input type="radio" name="switch-mode" checked={mode === item.value} disabled={!!item.off} onChange={() => setMode(item.value)} />
            <b>{item.label}</b><small>{item.off ?? item.hint}</small>
          </label>
        ))}
      </fieldset>
      <p className="acct-plan" role="status">{checking ? "Checking…" : plan ? (complex ? (plan.needsIdle ? "This Agent is busy. Stop it or switch after this turn." : "This also moves other Agents.") : plan.reason || (plan.allowed ? "Ready." : "Not allowed.")) : ""}{plan?.sessionLinked === false ? " The session cannot be linked; choose Hand off." : ""}</p>
      <div className="acct-actions">
        {complex ? <button type="button" className="btn" onClick={() => { close(); openAccounts(agent.paneId); }}>More options…</button> : null}
        <button type="button" className="btn primary" disabled={!ready} onClick={confirm}>{sending ? "Switching…" : `Switch to ${shortLabel(account)}`}</button>
      </div>
    </div>
  );
}
