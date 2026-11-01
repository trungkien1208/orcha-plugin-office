import { useEffect } from "react";
import { Workspace } from "../home/Home.tsx";
import { selectPane } from "../store.ts";

/** Same workspace as Home without the Floor: the chat gets the whole width. */
export function Conversation({ paneId }: { paneId: string }) {
  useEffect(() => { selectPane(paneId); }, [paneId]);
  return <Workspace mode="chat" />;
}
