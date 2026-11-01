import { useState } from "react";
import { focusAccountPane, loginAccount } from "../api-accounts.ts";
import { HealthBars } from "../chat/Context.tsx";
import { go } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { AccountBadge, useAccounts } from "./Accounts.tsx";

export const openAccountsSettings = () => go({ name: "settings", section: "accounts" });

const UNAVAILABLE = "Needs Orcha's account API";

/** Settings → Accounts: every account the bridge sees, its fuel, its Agents, and sign-in. */
export function AccountsPanel() {
  const { accounts, note: loadNote, refresh } = useAccounts();
  const { office } = useOffice();
  const [busy, setBusy] = useState<string>();
  const [note, setNote] = useState("");
  const [loginPane, setLoginPane] = useState<string>();

  const signIn = (id: string) => {
    setBusy(id);
    setNote("");
    void loginAccount(id)
      .then((result) => {
        if (!result.available) { setNote(result.reason); return; }
        setLoginPane(result.data.paneId);
        setNote("Finish signing in in Orcha, then refresh.");
      })
      .catch((error: unknown) => setNote(error instanceof Error ? error.message : "Sign-in failed"))
      .finally(() => setBusy(undefined));
  };

  return (
    <div className="settings-stack">
      <div className="settings-row-head">
        <p className="muted">Accounts and fuel as Orcha reports them. Sign-in opens a separate Orcha tab.</p>
        <button type="button" className="btn" onClick={refresh}>Refresh</button>
      </div>
      {loadNote || note ? <p className="settings-note" role="status">{loadNote || note}</p> : null}
      {loginPane ? <button type="button" className="btn" onClick={() => void focusAccountPane(loginPane).then((result) => { if (!result.available) setNote(result.reason); })}>Open the sign-in tab in Orcha</button> : null}
      <div className="settings-accounts">
        {accounts.map((account) => {
          const agents = account.panes.map((pane) => office?.agents.find((agent) => agent.paneId === pane)?.name ?? pane);
          return (
            <article key={account.id} className="settings-account">
              <header>
                <AccountBadge kind={account.kind} />
                <span className="settings-account-name">
                  <b>{account.label}</b>
                  <small>{[account.email, account.plan].filter(Boolean).join(" · ") || "Profile unavailable"}</small>
                </span>
                {account.active ? <span className="acct-tag">Default</span> : null}
                {account.signedIn ? <span className="acct-tag ghost">Signed in</span> : <button type="button" className="btn primary" disabled={busy === account.id} onClick={() => signIn(account.id)}>{busy === account.id ? "Opening…" : "Sign in"}</button>}
              </header>
              {account.fuel.length ? <HealthBars fuel={{ account: account.id, label: account.label, windows: account.fuel }} /> : <p className="muted">No fuel data yet.</p>}
              <p className="muted">Agents: {agents.join(", ") || "none"}</p>
            </article>
          );
        })}
        {!accounts.length && !loadNote ? <p className="muted">No accounts found.</p> : null}
      </div>
      <p className="muted">Add, rename, remove and make default: {UNAVAILABLE}.</p>
    </div>
  );
}
