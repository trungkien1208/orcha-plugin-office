import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Agent } from "@easy-job/shared";
import { handoffAgent } from "../api-accounts.ts";
import type { AccountAgent, AccountKind, Capabilities } from "../api-accounts.ts";
import { selectCreatedAgent } from "./CreatedAgent.tsx";
import { useOffice } from "../useOffice.ts";
import { useAccounts } from "./Accounts.tsx";
import { BatchDialog } from "./BatchDialog.tsx";
export function LowFuel({ agent }: { agent: Agent }) {
  return (agent as AccountAgent).lowFuel ? (
    <button
      type="button"
      className="low-fuel"
      title="Low fuel: hand off to a new Agent"
      onClick={() => window.dispatchEvent(new CustomEvent("easy-job-handoff", { detail: agent.paneId }))}
    >
      Low fuel: hand off?
    </button>
  ) : null;
}
export function HandoffHost() {
  const [pane, setPane] = useState<string>(),
    { office } = useOffice();
  useEffect(() => {
    const open = (e: Event) => setPane((e as CustomEvent<string>).detail);
    window.addEventListener("easy-job-handoff", open);
    return () => window.removeEventListener("easy-job-handoff", open);
  }, []);
  const agent = office?.agents.find((a) => a.paneId === pane);
  return agent ? <HandoffDialog key={agent.paneId} agent={agent} close={() => setPane(undefined)} /> : null;
}
export function HandoffDialog({ agent, close }: { agent: Agent; close: () => void }) {
  const { accounts, note: accountNote } = useAccounts(),
    { office } = useOffice(),
    [kind, setKind] = useState<AccountKind>(
      ["claude", "codex", "cursor"].includes(agent.kind) ? (agent.kind as AccountKind) : "other",
    ),
    [account, setAccount] = useState(""),
    [mode, setMode] = useState<"full" | "summary">("summary"),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [complete, setComplete] = useState(false);
  const capable = (office as typeof office & { capabilities?: Capabilities })?.capabilities?.handoff === true;
  return (
    <BatchDialog title={`Hand off ${agent.name}`} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!capable || busy || complete) return;
          setBusy(true);
          setNote("");
          void handoffAgent(agent.paneId, { kind, accountId: account || undefined }, mode)
            .then((r) => {
              if (r.available) {
                setComplete(true);
                toast.success("New Agent created", { description: "The original Agent stays on the Floor." });
                selectCreatedAgent(r.data.paneId);
              } else setNote(r.reason);
            })
            .catch((e) => setNote(e instanceof Error ? e.message : "Hand-off failed"))
            .finally(() => setBusy(false));
        }}
      >
        <p>Start a new Agent with notes from this conversation. The original stays until you remove it.</p>
        <label>
          Target kind
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as AccountKind);
              setAccount("");
            }}
          >
            {["claude", "codex", "cursor", "other"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Target account
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Orcha default for this kind</option>
            {accounts
              .filter((a) => a.kind === kind)
              .map((a) => (
                <option key={a.id} value={a.id} disabled={!a.signedIn}>
                  {a.label}
                  {a.signedIn ? "" : " — sign in first"}
                </option>
              ))}
          </select>
        </label>
        {accountNote ? <p>{accountNote} You can still choose a kind's default when hand-off is supported.</p> : null}
        <fieldset>
          <legend>Conversation notes</legend>
          {(["summary", "full"] as const).map((value) => (
            <label className="check" key={value}>
              <input type="radio" name="handoff-mode" checked={mode === value} onChange={() => setMode(value)} />
              {value === "summary" ? "Summary — compact hand-off notes" : "Full — include the full conversation"}
            </label>
          ))}
        </fieldset>
        {!capable ? (
          <p role="status">Hand off unavailable: the bridge has not advertised a hand-off capability.</p>
        ) : null}
        <p role="status">{note}</p>
        <footer>
          <button type="button" onClick={close}>
            {complete ? "Done" : "Cancel"}
          </button>
          <button type="submit" disabled={!capable || busy || complete}>
            {busy ? "Creating Agent…" : "Confirm hand off"}
          </button>
        </footer>
      </form>
    </BatchDialog>
  );
}
