import { useEffect, useState } from "react";
import { useAccountsQuery } from "../queries.ts";
import { listAccounts, loginAccount, planSwitch, stopAndSwitch, switchAccount } from "../api-accounts.ts";
import type { AccountAgent, AccountInfo, Capabilities, SwitchMode, SwitchPlan } from "../api-accounts.ts";
import { selectCreatedAgent } from "./CreatedAgent.tsx";
import { useOffice } from "../useOffice.ts";
import { BatchDialog } from "./BatchDialog.tsx";
export const openAccounts = (pane: string) =>
  window.dispatchEvent(new CustomEvent("easy-job-switch-account", { detail: pane }));
export function useAccounts() {
  const query = useAccountsQuery();
  const result = query.data;
  const note = query.isPending ? "Loading accounts…" : query.error ? (query.error instanceof Error ? query.error.message : "Could not load accounts") : result && !result.available ? result.reason : "";
  return { accounts: result?.available ? result.data : [], note, refresh: () => void query.refetch() };
}
export function AccountBadge({ kind }: { kind: string }) {
  const f = Math.max(0, ["claude", "codex", "cursor", "other"].indexOf(kind));
  return <span aria-hidden="true" className="account-badge" style={{ backgroundPosition: `-${f * 16}px 0` }} />;
}
export function AccountHost() {
  const snap = useOffice(),
    [pane, setPane] = useState<string>();
  useEffect(() => {
    const open = (e: Event) => setPane((e as CustomEvent<string>).detail);
    window.addEventListener("easy-job-switch-account", open);
    return () => window.removeEventListener("easy-job-switch-account", open);
  }, []);
  const agent = snap.office?.agents.find((a) => a.paneId === pane);
  return agent ? <AccountDialog key={agent.paneId} agent={agent} close={() => setPane(undefined)} /> : null;
}
function storedMode(): SwitchMode {
  try {
    const mode = localStorage.getItem("easy-job-switch-mode");
    return mode === "keychain" || mode === "handoff" ? mode : "restart";
  } catch {
    return "restart";
  }
}
export function AccountDialog({ agent, close }: { agent: AccountAgent; close: () => void }) {
  const { accounts, note: loadNote, refresh } = useAccounts(),
    snap = useOffice();
  const capabilities = (snap.office as typeof snap.office & { capabilities?: Capabilities })?.capabilities;
  const [target, setTarget] = useState<AccountInfo>(),
    [mode, setMode] = useState<SwitchMode>(storedMode),
    [plan, setPlan] = useState<SwitchPlan>(),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [moveAll, setMoveAll] = useState(false),
    [note, setNote] = useState("");
  const id = target?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: account pushes and status changes invalidate a switch dry run
  useEffect(() => {
    setPlan(undefined);
    setMoveAll(false);
    if (!id) return;
    let live = true;
    setPending(true);
    setNote("");
    void planSwitch(agent.paneId, id, mode)
      .then((r) => {
        if (live) {
          if (r.available) setPlan(r.data);
          else setNote(r.reason);
        }
      })
      .catch((e) => {
        if (live) setNote(e instanceof Error ? e.message : "Plan failed");
      })
      .finally(() => {
        if (live) setPending(false);
      });
    return () => {
      live = false;
    };
  }, [id, mode, agent.paneId, agent.status, accounts]);
  const allowed =
    accounts.some((a) => a.id === id && a.kind === agent.kind && a.signedIn) &&
    !!plan?.allowed &&
    plan.mode === mode &&
    !pending &&
    !busy &&
    !(mode === "restart" && plan.sessionLinked === false) &&
    !(mode === "keychain" && (!capabilities?.accountApi || (plan.alsoMoves.length && !moveAll))) &&
    !(mode === "handoff" && !capabilities?.handoff);
  const submit = (whenIdle = false, stop = false) => {
    if (!target || !allowed) return;
    setBusy(true);
    try {
      localStorage.setItem("easy-job-switch-mode", mode);
    } catch {}
    void (
      stop
        ? stopAndSwitch(agent.paneId, target.id)
        : switchAccount(agent.paneId, target.id, mode, { moveAll, whenIdle })
    )
      .then((r) => {
        if (r.available) {
          setPlan(undefined);
          setNote(
            whenIdle
              ? "Account switch queued after this turn."
              : `Switch request accepted for ${target.label}. Waiting for Orcha.`,
          );
          if (r.data && "paneId" in r.data && typeof r.data.paneId === "string" && r.data.paneId !== agent.paneId)
            selectCreatedAgent(r.data.paneId);
        } else setNote(r.reason);
      })
      .catch((e) => setNote(e instanceof Error ? e.message : "Switch failed"))
      .finally(() => setBusy(false));
  };
  return (
    <BatchDialog title={`Account for ${agent.name}`} close={close}>
      {!target ? (
        <>
          <p>Switching may restart this Agent. Review a dry run before confirming.</p>
          <p role="status">{loadNote || note}</p>
          <div className="account-list">
            {accounts
              .filter((a) => a.kind === agent.kind)
              .map((a) => {
                const current = agent.accountId === a.id || a.panes.includes(agent.paneId);
                return (
                  <article key={a.id}>
                    <AccountBadge kind={a.kind} />
                    <div>
                      <b>
                        {a.label}
                        {current ? " ✓ Current" : ""}
                      </b>
                      <p>{[a.email, a.plan].filter(Boolean).join(" · ")}</p>
                      <p>{a.fuel.map((f) => `${f.label}: ${f.left}%`).join(" · ") || "Fuel unavailable"}</p>
                    </div>
                    {a.signedIn ? (
                      <button type="button" disabled={current} onClick={() => setTarget(a)}>
                        Choose
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void loginAccount(a.id)
                            .then((r) => setNote(r.available ? "Finish signing in in Orcha." : r.reason))
                            .catch((e) => setNote(String(e)))
                            .finally(() => setBusy(false));
                        }}
                      >
                        Sign in…
                      </button>
                    )}
                  </article>
                );
              })}
          </div>
          <button type="button" onClick={refresh}>
            Refresh accounts
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => setTarget(undefined)}>
            ← Accounts
          </button>
          <h3>{target.label}</h3>
          <label>
            Switch method
            <select value={mode} onChange={(e) => setMode(e.target.value as SwitchMode)}>
              <option value="keychain" disabled={!capabilities?.accountApi}>
                Keep the conversation — {capabilities?.accountApi ? "fast" : "needs Orcha account API"}
              </option>
              <option value="restart">Fresh sign-in — restart and resume</option>
              <option value="handoff" disabled={!capabilities?.handoff}>
                Hand off — {capabilities?.handoff ? "new Agent" : "unavailable"}
              </option>
            </select>
          </label>
          {pending ? <p role="status">Checking the switch plan…</p> : null}
          {plan ? (
            <section className="switch-plan">
              <b>{plan.allowed ? "Plan ready" : "Switch not allowed"}</b>
              <p>{plan.reason}</p>
              {mode === "keychain" && plan.alsoMoves.length ? (
                <>
                  <p>
                    This also moves:{" "}
                    {plan.alsoMoves.map((p) => snap.office?.agents.find((a) => a.paneId === p)?.name || p).join(", ")}
                  </p>
                  <label className="check">
                    <input type="checkbox" checked={moveAll} onChange={(e) => setMoveAll(e.target.checked)} /> Move all
                    listed Agents
                  </label>
                  <button type="button" onClick={() => setMode("restart")}>
                    Restart only this Agent instead
                  </button>
                </>
              ) : null}
              {plan.sessionLinked === false ? (
                <p>
                  Session cannot be linked in the new folder. Choose Hand off instead; the session will never be moved.
                </p>
              ) : null}
              {plan.needsIdle ? <p>This Agent is busy. Switch after this turn, or explicitly stop it first.</p> : null}
            </section>
          ) : null}
          <p role="status">{note}</p>
          <footer>
            <button type="button" onClick={close}>
              Cancel
            </button>
            {plan?.needsIdle && mode === "restart" ? (
              <>
                <button type="button" disabled={!allowed} onClick={() => submit(false, true)}>
                  Stop and switch now
                </button>
                <button type="button" disabled={!allowed} onClick={() => submit(true)}>
                  Switch after this turn
                </button>
              </>
            ) : (
              <button type="button" disabled={!allowed} onClick={() => submit()}>
                Confirm switch
              </button>
            )}
          </footer>
        </>
      )}
    </BatchDialog>
  );
}
