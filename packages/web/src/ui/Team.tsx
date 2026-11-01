import { useCallback, useEffect, useRef, useState } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
import type { Agent } from "@easy-job/shared";
import { teamPrompt, teamThread } from "../api-accounts.ts";
import type { ThreadItem } from "../api-accounts.ts";
import { useOffice } from "../useOffice.ts";
import { queryClient, useTeamThread } from "../queries.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clock } from "../format.ts";
import { Portrait } from "./Header.tsx";
import { BatchDialog } from "./BatchDialog.tsx";
import { mergeThread, observeThread, validateRecipients } from "./teams.ts";
export function TeamFlightObserver() {
  const snap = useOffice(),
    workspace = snap.office?.agents.find((a) => a.paneId === snap.paneId)?.workspaceId,
    onFloor = snap.route.name === "home";
  // Paper planes only fly on the Floor; the query pauses in a hidden tab on its own.
  const motion = !snap.calm && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const thread = useTeamThread(workspace, onFloor && motion).data;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!workspace || !thread?.available) return;
    observeThread(workspace, thread.data.items, seen.current === workspace);
    seen.current = workspace;
  }, [workspace, thread]);
  return null;
}
export function TeamView({ agent }: { agent: Agent }) {
  const { office } = useOffice(),
    workspace = agent.workspaceId,
    people = office?.agents.filter((a) => a.workspaceId === workspace) ?? [];
  const [items, setItems] = useState<ThreadItem[]>([]),
    [note, setNote] = useState("Loading Team thread…"),
    [paging, setPaging] = useState(false),
    [older, setOlder] = useState(true);
  // The newest page is a shared, polled query; older pages are fetched on demand and merged in.
  const latest = useTeamThread(workspace).data;
  useEffect(() => {
    if (!latest) return;
    if (!latest.available) {
      setNote(latest.reason);
      return;
    }
    observeThread(workspace, latest.data.items, true);
    setItems((current) => mergeThread(current, latest.data.items));
    setNote("");
  }, [latest, workspace]);
  const load = useCallback(
    async (before?: string) => {
      try {
        const result = await teamThread(workspace, before);
        if (!result.available) {
          setNote(result.reason);
          return;
        }
        setItems((current) => mergeThread(current, result.data.items));
        if (before && result.data.items.length === 0) setOlder(false);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not load Team thread");
      }
    },
    [workspace],
  );
  return (
    <div className="team-view">
      <div className="team-toolbar">
        <b>Team · {people.length} Agents</b>
        <button
          type="button"
          className="btn"
          disabled={paging || !items.length || !older}
          onClick={() => {
            setPaging(true);
            void load(items[0]?.id).finally(() => setPaging(false));
          }}
        >
          {paging ? "Loading…" : "Load earlier"}
        </button>
        <button type="button" className="btn" onClick={() => void queryClient.invalidateQueries({ queryKey: ["team", workspace] })}>
          Refresh
        </button>
      </div>
      {/* Follows new messages only while you are at the bottom; "Load earlier" never yanks the view. */}
      <StickToBottom className="team-scroll" resize="smooth" initial="instant">
        <StickToBottom.Content scrollClassName="team-thread" role="log" aria-label="Team conversation">
        {note ? <p role="status">{note}</p> : null}
        {!items.length && !note ? <p>No Team messages yet.</p> : null}
        {items.map((item) => {
          const author = people.find((a) => a.paneId === item.paneId),
            from = people.find((a) => a.paneId === item.from),
            project = office?.projects.find((p) => p.workspaceId === workspace);
          return (
            <article className="team-message" key={`${item.paneId}:${item.id}`}>
              <Portrait
                color={project?.projectColor ?? "#8fa3a0"}
                skin={author?.skin}
                name={author?.name || item.paneId}
              />
              <div>
                <header>
                  <b>
                    {item.from
                      ? `${from?.name || "Another agent"} → ${author?.name || item.paneId}`
                      : item.role === "user"
                        ? `You → ${author?.name || item.paneId}`
                        : author?.name || item.paneId}
                  </b>
                  <time>{clock(item.at)}</time>
                </header>
                {item.text ? (
                  <div className="team-text bubble md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="team-tool">{item.tool?.summary || "Tool activity"}</p>
                )}
              </div>
            </article>
          );
        })}
        </StickToBottom.Content>
      </StickToBottom>
      <TeamComposer key={workspace} workspace={workspace} people={people} />
    </div>
  );
}
function TeamComposer({ workspace, people }: { workspace: string; people: Agent[] }) {
  const [to, setTo] = useState(() => people.slice(0, 5).map((a) => a.paneId)),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  return (
    <form
      className="team-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !text.trim()) return;
        let recipients: string[];
        try {
          recipients = validateRecipients(
            people.map((a) => a.paneId),
            to,
          );
        } catch (e) {
          setNote(String(e));
          return;
        }
        setBusy(true);
        void teamPrompt(workspace, recipients, text.trim())
          .then((r) => {
            if (!r.available) {
              setNote(r.reason);
              return;
            }
            const failed = r.data.results.filter((item) => !item.ok);
            const sent = r.data.results.length - failed.length;
            if (sent) toast.success(`Sent to ${sent} Agent${sent === 1 ? "" : "s"}`);
            // Failures stay inline next to the recipients that are kept for a retry.
            setNote(failed.length ? `Not sent: ${failed.map((f) => `${people.find((a) => a.paneId === f.paneId)?.name || f.paneId}: ${f.error || "not sent"}`).join("; ")}` : "");
            if (failed.length) setTo(failed.map((f) => f.paneId));
            else setText("");
          })
          .catch((e) => setNote(e instanceof Error ? e.message : "Could not send"))
          .finally(() => setBusy(false));
      }}
    >
      <fieldset>
        <legend>Send to · {to.length}/5</legend>
        {people.length > 5 ? <small>First five selected. Choose up to five teammates per prompt.</small> : null}
        {people.map((a) => (
          <label className="check" key={a.paneId}>
            <input
              type="checkbox"
              checked={to.includes(a.paneId)}
              disabled={!to.includes(a.paneId) && to.length >= 5}
              onChange={(e) =>
                setTo((current) =>
                  e.target.checked ? [...current, a.paneId] : current.filter((id) => id !== a.paneId),
                )
              }
            />
            {a.name}
          </label>
        ))}
      </fieldset>
      <textarea
        aria-label="Message teammates"
        placeholder="Ask the selected teammates…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      <button type="submit" className="btn primary team-send" disabled={busy || !to.length || !text.trim()}>
        {busy ? "Sending…" : `Send to ${to.length}`}
      </button>
      <p role="status">{note}</p>
    </form>
  );
}
export function AskTeammate({ source, text }: { source: string; text: string }) {
  const { office } = useOffice(),
    agent = office?.agents.find((a) => a.paneId === source),
    people = office?.agents.filter((a) => a.workspaceId === agent?.workspaceId && a.paneId !== source) ?? [];
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  if (!agent) return null;
  return (
    <>
      <button
        type="button"
        disabled={!people.length}
        onClick={() => {
          setTarget(people[0]?.paneId ?? "");
          setNote("");
          setOpen(true);
        }}
      >
        Ask a teammate
      </button>
      {open ? (
        <BatchDialog title="Ask a teammate to review" close={() => setOpen(false)}>
          <p>This forwards the selected message only after you confirm.</p>
          <label>
            Teammate
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {people.map((a) => (
                <option key={a.paneId} value={a.paneId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <pre className="review-message">
            Please review:{"\n\n"}
            {text}
          </pre>
          <p role="status">{note}</p>
          <footer>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !target}
              onClick={() => {
                if (!people.some((a) => a.paneId === target)) return;
                setBusy(true);
                void teamPrompt(agent.workspaceId, [target], `Please review:\n\n${text}`)
                  .then((r) => {
                    if (!r.available) {
                      setNote(r.reason);
                      return;
                    }
                    const item = r.data.results.find((result) => result.paneId === target);
                    if (item?.ok) toast.success("Sent to 1 teammate");
                    else setNote(item?.error || "The message was not sent.");
                    if (item?.ok) setTarget("");
                  })
                  .catch((e) => setNote(String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Sending…" : "Confirm and send"}
            </button>
          </footer>
        </BatchDialog>
      ) : null}
    </>
  );
}
