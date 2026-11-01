import { useEffect, useState } from "react";
import { toast } from "sonner";
import { selectPane } from "../store.ts";
import { useOffice } from "../useOffice.ts";
export const selectCreatedAgent = (pane: string) =>
  window.dispatchEvent(new CustomEvent("easy-job-created-agent", { detail: pane }));
/** Do not let the workspace's missing-agent fallback replace a newly created pane before its first snapshot. */
export function CreatedAgentSelection() {
  const { office } = useOffice(),
    [pending, setPending] = useState<string>();
  useEffect(() => {
    const listener = (e: Event) => {
      setPending((e as CustomEvent<string>).detail);
      toast.loading("Waiting for Orcha to report the new Agent…", { id: "created-agent" });
    };
    window.addEventListener("easy-job-created-agent", listener);
    return () => window.removeEventListener("easy-job-created-agent", listener);
  }, []);
  useEffect(() => {
    const agent = pending ? office?.agents.find((a) => a.paneId === pending) : undefined;
    if (pending && agent) {
      toast.success(`${agent.name} is on the Floor`, { id: "created-agent" });
      selectPane(pending);
      setPending(undefined);
    }
  }, [pending, office]);
  return null;
}
