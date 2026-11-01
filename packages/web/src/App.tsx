import { useCallback, useState } from "react";
import { api } from "./api.ts";
import { Header } from "./ui/Header.tsx";
import { Conversation } from "./conversation/Conversation.tsx";
import { EntryGate } from "./ui/EntryGate.tsx";
import { Home } from "./home/Home.tsx";
import { SettingsView } from "./settings/Settings.tsx";
import { useOffice } from "./useOffice.ts";

export function App() {
  const snap = useOffice();
  const [entered,setEntered]=useState(false);
  const enter=useCallback(()=>setEntered(true),[]);
  if (snap.tokenMissing) {
    return <EntryGate state="denied"/>;
  }
  if (!snap.office) return <EntryGate state="connecting"/>;
  if (!entered && !snap.office.orcha.connected) return <EntryGate state="down"><StartOrcha/></EntryGate>;

  const stale = snap.socket !== "open" ? "stale" : snap.office.orcha.connected ? "" : "stale";
  return (
    <>
    <div className={`app ${stale}`} inert={!entered}>
      <Header />
      {snap.route.name === "conversation" ? <Conversation paneId={snap.route.paneId} /> : snap.route.name === "settings" ? <SettingsView section={snap.route.section} /> : <Home />}
    </div>
    {!entered && <EntryGate state="approved" onEntered={enter}/>}
    </>
  );
}

/** Starts `orcha server` in the background after a confirm; or the user can just type `orcha`. */
function StartOrcha() {
  const [step, setStep] = useState<"idle" | "confirm" | "starting" | "error">("idle");
  const [message, setMessage] = useState("");
  if (step === "confirm") {
    return (
      <div className="row">
        <span>Start Orcha's server in the background?</span>
        <button type="button" className="btn blue" onClick={() => {
          setStep("starting");
          void api<{ message: string }>("/api/orcha/start", { method: "POST" })
            .then((result) => setMessage(result.message))
            .catch((err: unknown) => { setStep("error"); setMessage(err instanceof Error ? err.message : "Could not start Orcha"); });
        }}>Start</button>
        <button type="button" className="btn" onClick={() => setStep("idle")}>Cancel</button>
      </div>
    );
  }
  return (
    <div>
      <button type="button" className="btn blue" disabled={step === "starting"} onClick={() => setStep("confirm")}>Start Orcha</button>
      <p className="task">{message || "Or type `orcha` in a terminal."}</p>
    </div>
  );
}
