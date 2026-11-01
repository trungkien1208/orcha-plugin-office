import { questionChoices, type Agent, type ConversationItem } from "@easy-job/shared";
import { useFuel, useRepoFiles } from "../queries.ts";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu.tsx";
import { Modal, ModalTitle } from "../ui/Modal.tsx";
import TextareaAutosize from "react-textarea-autosize";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { api } from "../api.ts";
import { clock, dayLabel, statusColor, statusText, waiting } from "../format.ts";
import { markSent, serverNow } from "../store.ts";
import { useOffice } from "../useOffice.ts";
import { Portrait } from "../ui/Header.tsx";
import { AgentPills } from "../ui/AgentPills.tsx";
import { LowFuel } from "../ui/Handoff.tsx";
import { TeamView, AskTeammate } from "../ui/Team.tsx";
import { validateRecipients } from "../ui/teams.ts";
import { teamPrompt } from "../api-accounts.ts";
import { Icon } from "../ui/Icon.tsx";
import { HealthBars, SetupView, useAgentContext } from "./Context.tsx";
import "./turns.css";
import "./question.css";
import { pathResolver, uploadId, uploadImages } from "./paths.ts";
import { AuthImage, ImagePreview } from "../ui/AuthImage.tsx";
import { FilesView } from "./Files.tsx";

type Who = { name: string; skin: string; color: string; paneId?: string };
export type Outgoing = { id: string; text: string; at: number };

const TOOL_ICON: Record<string, string> = { bash: "tool-bash", read: "tool-read", edit: "tool-edit", multiedit: "tool-edit", write: "tool-write", grep: "tool-grep", glob: "tool-grep", webfetch: "tool-web", websearch: "tool-web", task: "tool-task", agent: "tool-task", todowrite: "tool-todo" };
const toolIcon = (name?: string) => <Icon name={TOOL_ICON[(name ?? "").toLowerCase()] ?? "tool"} />;

function copy(text: string) {
  void navigator.clipboard?.writeText(text).then(() => toast.success("Copied")).catch(() => toast.error("Could not copy"));
}

/** The text inside highlighted code (React children of spans), for Copy. */
function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  return plainText((node as { props?: { children?: ReactNode } }).props?.children);
}

/** Fenced code with its language and a copy button, like Claude. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const [done, setDone] = useState(false);
  const child = Array.isArray(children) ? children[0] : children;
  const props = (child as { props?: { className?: string; children?: ReactNode } } | undefined)?.props;
  const lang = props?.className?.match(/language-(\S+)/)?.[1] ?? "";
  const text = plainText(props?.children).replace(/\n$/, "");
  return (
    <div className="code">
      <div className="code-head"><span>{lang || "code"}</span><button type="button" onClick={() => { copy(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>{done ? "Copied" : "Copy"}</button></div>
      <pre>{children}</pre>
    </div>
  );
}

/** Syntax colours for fenced code; bundled, no network. Unknown languages stay plain. */
const REHYPE = [[rehypeHighlight, { detect: false }]] as never;

const MARKDOWN = { pre: CodeBlock, a: ({ href, children }: { href?: string; children?: ReactNode }) => <a href={href} target="_blank" rel="noreferrer noopener">{children}</a> };

/**
 * Markdown for a transcript that can open what it mentions: `path/like.ts` in inline code and relative links open
 * in the Files tab, uploaded images show inline. Everything stays text; nothing from the Agent becomes HTML.
 */
function linkedMarkdown(openPath?: (path: string) => void, resolve?: (raw: string) => string | null) {
  if (!openPath || !resolve) return MARKDOWN;
  return {
    pre: CodeBlock,
    code: ({ className, children }: { className?: string; children?: ReactNode }) => {
      const text = plainText(children);
      if (className || text.includes("\n")) return <code className={className}>{children}</code>;
      const upload = uploadId(text);
      if (upload) return <AuthImage src={`/api/uploads/${encodeURIComponent(upload)}`} alt={text.split("/").pop() ?? "image"} />;
      const target = resolve(text);
      if (target === null) return <code>{children}</code>;
      return <button type="button" className="code-link" title={`Open ${target || "the project folder"}`} onClick={() => openPath(target)}><code>{children}</code></button>;
    },
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      const target = href && !/^[a-z]+:/i.test(href) && !href.startsWith("#") ? resolve(decodeURI(href)) : null;
      return target !== null
        ? <button type="button" className="code-link text" title={`Open ${target}`} onClick={() => openPath(target)}>{children}</button>
        : <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>;
    },
  };
}

/** Claude-style transcript: Agent text as plain prose, Owner on the right, tool calls folded, a live working line and a jump-to-latest button. */
export function MessageList({ items, terminal, agent, outbox = [], working, onEdit, onOpenPath, resolvePath }: { items: ConversationItem[]; terminal: boolean; agent: Who; outbox?: Outgoing[]; working?: { stage?: string; since: number } | null; onEdit?: (text: string) => void; onOpenPath?: (path: string) => void; resolvePath?: (raw: string) => string | null }) {
  const markdown = useMemo(() => linkedMarkdown(onOpenPath, resolvePath), [onOpenPath, resolvePath]);
  const pending = outbox.filter((out) => !items.some((item) => item.role === "user" && item.at >= out.at - 5000 && (item.text ?? "").trim() === out.text.trim()));
  const turns = byTurn(items);
  return (
    // use-stick-to-bottom follows new and growing messages until you scroll up, and stops following until you come back.
    <StickToBottom className="messages-wrap" resize="smooth" initial="instant">
      <StickToBottom.Content scrollClassName="messages" className="messages-inner">
        {terminal ? <p className="notice">No conversation file for this Agent. Showing its recent terminal text.</p> : null}
        {!items.length && !pending.length ? <p className="notice">No messages yet. Send the first Prompt below.</p> : null}
        {turns.map((turn, index) => {
          // Cursor lines carry no time (at 0): no day line and no clock for them.
          const day = turn.at ? dayLabel(turn.at) : "", prev = turns.slice(0, index).reverse().find((entry) => entry.at);
          const divider = day && (!prev || dayLabel(prev.at) !== day) ? <div className="day-divider"><span>{day}</span></div> : null;
          if (turn.kind === "system") {
            const item = turn.item;
            return <Fragment key={item.id}>{divider}{terminal ? <pre className="terminal">{item.text}</pre> : <p className="notice">{item.text}</p>}</Fragment>;
          }
          if (turn.kind === "user") {
            const item = turn.item;
            const { ids, rest } = uploadImages(item.text ?? "");
            return (
              <Fragment key={item.id}>
                {divider}
                <div className="msg user">
                  <div className="body">
                    <div className="who">You{item.at ? ` · ${clock(item.at)}` : ""}</div>
                    <div className="bubble">
                      {rest ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={REHYPE} components={markdown}>{rest}</ReactMarkdown> : null}
                      {ids.length || item.images?.length ? (
                        <div className="bubble-images">
                          {ids.map((id) => <AuthImage key={id} src={`/api/uploads/${encodeURIComponent(id)}`} alt={id.split("/").pop() ?? "image"} />)}
                          {item.images?.map((image) => <ImagePreview key={image.dataUrl.slice(-48)} alt="Image" src={image.dataUrl} />)}
                        </div>
                      ) : null}
                    </div>
                    <div className="msg-tools">
                      <button type="button" onClick={() => copy(item.text ?? "")}>Copy</button>
                      {onEdit ? <button type="button" onClick={() => onEdit(item.text ?? "")} title="Put this prompt back in the composer to edit and resend">Edit</button> : null}
                    </div>
                  </div>
                  <Portrait color="#1d2742" name="You" skin="boss" />
                </div>
              </Fragment>
            );
          }
          const text = turn.parts.filter((part): part is ConversationItem => !Array.isArray(part) && part.role === "agent" && !!part.text).map((part) => part.text).join("\n\n");
          return (
            <Fragment key={turn.id}>
              {divider}
              <div className="msg agent turn">
                <Portrait color={agent.color} name={agent.name} skin={agent.skin} />
                <div className="body">
                  <div className="who">{agent.name}{turn.at ? ` · ${clock(turn.at)}` : ""}</div>
                  {turn.parts.map((part) => {
                    if (Array.isArray(part)) return <ToolRun key={part[0]?.id} tools={part} />;
                    if (part.role === "system") return <p key={part.id} className="notice turn-note">{part.text}</p>;
                    return (
                      <div key={part.id} className="bubble md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={REHYPE} components={markdown}>{part.text ?? ""}</ReactMarkdown>
                        {part.images?.map((image) => <ImagePreview key={image.dataUrl.slice(-48)} alt="Image" src={image.dataUrl} />)}
                      </div>
                    );
                  })}
                  {text ? (
                    <div className="turn-tools">
                      <button type="button" onClick={() => copy(text)} title="Copy everything the Agent wrote in this turn">Copy</button>
                      {agent.paneId ? <AskTeammate key={`${agent.paneId}:${turn.id}`} source={agent.paneId} text={text} /> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Fragment>
          );
        })}
        {pending.map((out) => (
          <div key={out.id} className="msg user sending">
            <div className="body">
              <div className="who">You · sending…</div>
              <div className="bubble"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={REHYPE} components={MARKDOWN}>{out.text}</ReactMarkdown></div>
            </div>
            <Portrait color="#1d2742" name="You" skin="boss" />
          </div>
        ))}
        {working ? <WorkingLine stage={working.stage} since={working.since} name={agent.name} /> : null}
      </StickToBottom.Content>
      <JumpToLatest count={items.length + pending.length} />
    </StickToBottom>
  );
}

/** "↓ Latest" while scrolled up, with how many messages arrived since. */
function JumpToLatest({ count }: { count: number }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const [since, setSince] = useState(count);
  useEffect(() => { if (isAtBottom) setSince(count); }, [isAtBottom, count]);
  if (isAtBottom) return null;
  const fresh = count - since;
  return <button type="button" className="jump" onClick={() => void scrollToBottom()}>↓ {fresh > 0 ? `${fresh} new` : "Latest"}</button>;
}

function WorkingLine({ stage, since, name }: { stage?: string; since: number; name: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const timer = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.round((Date.now() - since) / 1000));
  const took = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return <div className="working-line" aria-live="polite"><span className="spin" />{name} is {stage ? stage.toLowerCase() : "working"} · {took}</div>;
}


type Turn =
  | { kind: "user"; at: number; item: ConversationItem }
  | { kind: "system"; at: number; item: ConversationItem }
  | { kind: "agent"; id: string; at: number; parts: Array<ConversationItem | ConversationItem[]> };

/**
 * One block per Agent turn, like Claude's chat: everything the Agent writes and runs between two of your prompts
 * shares one name line, with consecutive tool calls folded into a run. Notes outside a turn stand alone.
 */
function byTurn(items: ConversationItem[]): Turn[] {
  const out: Turn[] = [];
  for (const item of items) {
    if (item.role === "user") { out.push({ kind: "user", at: item.at, item }); continue; }
    const last = out.at(-1);
    if (item.role === "system" && last?.kind !== "agent") { out.push({ kind: "system", at: item.at, item }); continue; }
    const turn = last?.kind === "agent" ? last : (() => { const fresh: Turn = { kind: "agent", id: item.id, at: item.at, parts: [] }; out.push(fresh); return fresh; })();
    const tail = turn.parts.at(-1);
    if (item.tool && Array.isArray(tail)) tail.push(item);
    else turn.parts.push(item.tool ? [item] : item);
  }
  return out;
}

function ToolLine({ item }: { item: ConversationItem }) {
  const [open, setOpen] = useState(false);
  const detail = item.tool?.detail && item.tool.detail !== item.tool.summary ? item.tool.detail : "";
  return (
    <div className="tool-item">
      <button type="button" className="tool-line" onClick={() => detail && setOpen((value) => !value)} aria-expanded={detail ? open : undefined}>
        <span className="ticon">{toolIcon(item.tool?.name)}</span>
        <span className="name">{item.tool?.name}</span>
        <span className="sum">{item.tool?.summary}</span>
        {item.tool?.ok === undefined ? <span className="spin small" /> : item.tool.ok ? <span className="ok"><Icon name="check" label="done" /></span> : <span className="bad"><Icon name="cross" label="failed" /></span>}
      </button>
      {open ? <pre className="tool-detail">{detail}</pre> : null}
    </div>
  );
}

function ToolRun({ tools }: { tools: ConversationItem[] }) {
  const [open, setOpen] = useState(false);
  const failed = tools.filter((item) => item.tool?.ok === false).length;
  const running = tools.some((item) => item.tool?.ok === undefined);
  const names = [...new Set(tools.map((item) => item.tool?.name))].slice(0, 3).join(", ");
  const images = tools.flatMap((item) => item.images ?? []);
  const shots = images.length ? <div className="tool-images">{images.map((image) => <ImagePreview key={image.dataUrl.slice(-48)} alt="Tool image" src={image.dataUrl} />)}</div> : null;
  if (tools.length === 1 && tools[0]) return <div className="tool-run"><ToolLine item={tools[0]} />{shots}</div>;
  return (
    <div className="tool-run">
      <button type="button" className="tool-line toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="ticon">{toolIcon(tools.at(-1)?.tool?.name)}</span>
        <span className="name">{tools.length} tool calls</span>
        <span className="sum">{names}</span>
        {running ? <span className="spin small" /> : failed ? <span className="bad">{failed} <Icon name="cross" label="failed" /></span> : <span className="ok"><Icon name="check" label="done" /></span>}
        <span className="chev"><Icon name={open ? "caret-down" : "caret-right"} /></span>
      </button>
      {open ? tools.map((item) => <ToolLine key={item.id} item={item} />) : null}
      {shots}
    </div>
  );
}


/** Only the question line is shown; the numbered options become the buttons (keys 1–9), Enter/Esc are small keycaps. */
export function QuestionCard({ paneId }: { paneId: string }) {
  const snap = useOffice();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  if (!snap.question) return null;
  async function send(path: string, body: unknown) {
    setError(null);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      markSent(paneId);
      setText("");
      setTyping(false);
      setPicked([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer");
    }
  }
  const base = `/api/agents/${encodeURIComponent(paneId)}`;
  const data = snap.questionData;
  const choices = questionChoices(snap.question);
  const options = choices.filter((choice) => choice.keys[0] !== "enter" && choice.keys[0] !== "esc");
  const question = data?.text.trim() ? data.text.trim() : snap.question.split("\n").map((line) => line.trim()).filter((line) => line && !/^[❯>]?\s*\d+[.)]\s/.test(line) && !/^\(?y\/n\)?$/i.test(line)).join(" ") || "The agent is waiting for you";
  return (
    <form className="question" onSubmit={(event) => { event.preventDefault(); if (text.trim()) void send(`${base}/answer`, { text }); }}>
      <div className="q-head"><span><Icon name="warning" /> Needs you</span><span className="q-text" title={question}>{question}</span></div>
      <div className="q-body">
        <div className="q-options">
          {data?.options.length
            ? data.options.map((option, index) => {
                const id = option.key ?? option.label;
                const on = picked.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="q-option"
                    aria-pressed={data.multiSelect ? on : undefined}
                    title={option.description}
                    onClick={() => {
                      if (data.multiSelect) setPicked((list) => (on ? list.filter((item) => item !== id) : [...list, id]));
                      else void send(`${base}/answer`, { option: id });
                    }}
                  >
                    <kbd>{data.multiSelect ? (on ? "✓" : "□") : index + 1}</kbd>{option.label}
                  </button>
                );
              })
            : options.map((choice) => (
            <button key={`${choice.label}:${choice.keys.join("+")}`} type="button" className="q-option" onClick={() => void send(`${base}/keys`, { keys: choice.keys })}>
              <kbd>{choice.keys[0]}</kbd>{choice.label}
            </button>
          ))}
          {data?.multiSelect ? (
            <button type="button" className="q-option" disabled={!picked.length} onClick={() => void send(`${base}/answer`, { options: picked })}>
              <kbd>⏎</kbd>Send {picked.length || ""}
            </button>
          ) : null}
        </div>
        <div className="q-side">
          <button type="button" className="q-key" title="Enter" aria-label="Enter" onClick={() => void send(`${base}/keys`, { keys: ["enter"] })}>⏎<span className="q-key-label"> Enter</span></button>
          <button type="button" className="q-key" title="Esc" aria-label="Esc" onClick={() => void send(`${base}/keys`, { keys: ["esc"] })}>Esc</button>
          {data && !data.freeText ? null : <button type="button" className="q-key" title="Type an answer" aria-label="Type an answer" onClick={() => setTyping((value) => !value)}>✎<span className="q-key-label"> Type</span></button>}
        </div>
      </div>
      {typing ? <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type an answer and press Enter" aria-label="Answer" /> : null}
      {error ? <p className="err">{error}</p> : null}
    </form>
  );
}

const history = new Map<string, string[]>();
/** Unsent text per Agent, kept while you switch between chats. */
export const drafts = new Map<string, string>();
const recipientDrafts = new Map<string,string[]>();

/** Claude-style composer: grows with the text, ↑ recalls the last prompts, / opens skills (arrows + Tab), Stop while the Agent works. */
export function Composer({ agent, onSent, tools }: { agent: Agent; onSent?: (text: string) => void; tools?: ReactNode }) {
  const snap=useOffice();
  const [recipients,setRecipients]=useState<string[]>(()=>recipientDrafts.get(agent.paneId)??[]),[sending,setSending]=useState(false),[mentionPick,setMentionPick]=useState(0);
  useEffect(()=>{if(recipients.length)recipientDrafts.set(agent.paneId,recipients);else recipientDrafts.delete(agent.paneId);},[agent.paneId,recipients]);
  const teammates=snap.office?.agents.filter(a=>a.workspaceId===agent.workspaceId)??[];
  const [text, setTextState] = useState(() => drafts.get(agent.paneId) ?? "");
  const setText = (value: string) => { setTextState(value); if (value) drafts.set(agent.paneId, value); else drafts.delete(agent.paneId); };
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<Array<{ name: string; description: string }>>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pick, setPick] = useState(0);
  const [recall, setRecall] = useState(-1);
  const area = useRef<HTMLTextAreaElement>(null);
  const slash = text.startsWith("/") && !text.includes(" ") ? text.slice(1).toLowerCase() : null;
  const mention=text.match(/@([^\s@]*)$/);
  const mentionMatches=mention?teammates.filter(a=>!recipients.includes(a.paneId)&&a.name.toLowerCase().includes((mention[1]??'').toLowerCase())).slice(0,8):[];
  const chooseMention=(pane:string)=>{if(recipients.length>=5){setError('Choose at most five teammates.');return;}setRecipients(current=>[...new Set([...current,pane])]);setText(text.replace(/@([^\s@]*)$/,''));setMentionPick(0);area.current?.focus();};
  const blocked = agent.status === "blocked";
  const working = agent.status === "working";

  useEffect(() => {
    void api<Array<{ name: string; description: string }>>(`/api/skills?pane=${encodeURIComponent(agent.paneId)}`).then(setSkills).catch(() => setSkills([]));
  }, [agent.paneId]);

  async function attach(list: File[]) {
    const paths: string[] = [];
    for (const file of list) {
      const body = new FormData();
      body.set("pane", agent.paneId);
      body.set("file", file);
      const saved = await api<{ path: string }>("/api/uploads", { method: "POST", body });
      paths.push(saved.path);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviews((current) => ({ ...current, [saved.path]: url }));
      }
    }
    setFiles((current) => [...current, ...paths]);
  }

  // react-dropzone: drop files anywhere on the composer, or pick them with the paperclip.
  const { getRootProps, getInputProps, isDragActive, open: openFiles } = useDropzone({
    onDrop: (dropped) => void attach(dropped).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not attach")),
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  async function send() {
    setError(null);
    const suffix = files.map((file) => (agent.kind === "codex" ? file : `@${file}`));
    const payload = [text.trim(), ...suffix].filter(Boolean).join("\n");
    if (!payload||sending) return;
    setSending(true);
    try {
      if(recipients.length){
        const to=validateRecipients(teammates.map(a=>a.paneId),recipients),result=await teamPrompt(agent.workspaceId,to,payload);
        if(!result.available){setError(result.reason);return;}
        const failed=result.data.results.filter(r=>!r.ok);toast.success(`Sent to ${result.data.results.filter(r=>r.ok).length} Agents`);
        if(failed.length){setRecipients(failed.map(r=>r.paneId));setError(failed.map(r=>`${teammates.find(a=>a.paneId===r.paneId)?.name||r.paneId}: ${r.error||'not sent'}`).join('; '));return;}
      }else await api(`/api/agents/${encodeURIComponent(agent.paneId)}/prompt`, { method: "POST", body: JSON.stringify({ text: payload }) });
      if(!recipients.length||recipients.includes(agent.paneId))markSent(agent.paneId);
      history.set(agent.paneId, [text.trim(), ...(history.get(agent.paneId) ?? [])].filter(Boolean).slice(0, 30));
      if(!recipients.length)onSent?.(payload);
      setRecipients([]);
      setText("");
      setFiles([]);
      for (const url of Object.values(previews)) URL.revokeObjectURL(url);
      setPreviews({});
      setRecall(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {setSending(false);}
  }

  async function stop() {
    setError(null);
    try {
      await api(`/api/agents/${encodeURIComponent(agent.paneId)}/interrupt`, { method: "POST" });
      markSent(agent.paneId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop");
    }
  }

  const matches = slash === null ? [] : skills.filter((skill) => skill.name.toLowerCase().includes(slash)).slice(0, 8);
  const choose = (name: string) => { setText(`/${name} `); setPick(0); area.current?.focus(); };
  return (
    <form {...getRootProps({ className: isDragActive ? "composer dragging" : "composer", onSubmit: (event) => { event.preventDefault(); void send(); } })}>
      {recipients.length?<fieldset className="recipient-chips" aria-label="Selected teammates">{recipients.map(pane=><button className="recipient-chip" key={pane} type="button" aria-label={`Remove ${teammates.find(a=>a.paneId===pane)?.name||pane}`} onClick={()=>setRecipients(ids=>ids.filter(id=>id!==pane))}>@{teammates.find(a=>a.paneId===pane)?.name||pane} ×</button>)}</fieldset>:null}
      {mentionMatches.length?<div className="mention-options" role="listbox" aria-label="Project teammates">{mentionMatches.map((a,i)=><button key={a.paneId} type="button" role="option" aria-selected={i===mentionPick} className={i===mentionPick?'on':undefined} disabled={recipients.length>=5} onClick={()=>chooseMention(a.paneId)}>@{a.name}</button>)}</div>:null}
      {matches.length ? (
        <div className="slash" role="listbox" aria-label="Skills">
          {matches.map((skill, index) => (
            <button key={skill.name} type="button" role="option" aria-selected={index === pick} className={index === pick ? "on" : undefined} onMouseEnter={() => setPick(index)} onClick={() => choose(skill.name)}><code className="slash-name">/{skill.name}</code><span className="task">{skill.description}</span></button>
          ))}
        </div>
      ) : null}
      <button type="button" className="attach" title="Attach images or files" aria-label="Attach images or files" onClick={openFiles}>
        <Icon name="attach" />
      </button>
      <input {...getInputProps({ "aria-label": "Attach files", style: { display: "none" } })} />
      <div className="input-box">
        <TextareaAutosize
          ref={area}
          value={text}
          minRows={2}
          maxRows={9}
          aria-label={`Message ${agent.name}`}
          placeholder={blocked ? "Answer the question above first" : working ? `${agent.name} is working · Esc stops · type to queue the next prompt` : `Message ${agent.name} · / skills · ! shell · ↑ last prompt`}
          onChange={(event) => { setText(event.target.value); setRecall(-1);setMentionPick(0); }}
          onPaste={(event) => {
            const images = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
            if (images.length) { event.preventDefault(); void attach(images); }
          }}
          onKeyDown={(event) => {
            if(mentionMatches.length&&event.key==='Escape'){event.preventDefault();setText(text.replace(/@([^\s@]*)$/,''));return;}
            if(mentionMatches.length&&['ArrowDown','ArrowUp','Enter','Tab'].includes(event.key)){event.preventDefault();if(event.key==='ArrowDown'||event.key==='ArrowUp')setMentionPick(i=>(i+(event.key==='ArrowDown'?1:mentionMatches.length-1))%mentionMatches.length);else{const target=mentionMatches[mentionPick];if(target)chooseMention(target.paneId);}return;}
            if (matches.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); setPick((value) => (value + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length); return; }
            if (matches.length && (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey))) { event.preventDefault(); const skill = matches[pick]; if (skill) choose(skill.name); return; }
            const past = history.get(agent.paneId) ?? [];
            if (event.key === "ArrowUp" && (!text || recall >= 0) && past.length) { event.preventDefault(); const next = Math.min(recall + 1, past.length - 1); setRecall(next); setText(past[next] ?? ""); return; }
            if (event.key === "ArrowDown" && recall >= 0) { event.preventDefault(); const next = recall - 1; setRecall(next); setText(next >= 0 ? past[next] ?? "" : ""); return; }
            if (event.key === "Escape" && working && !matches.length) { event.preventDefault(); void stop(); return; }
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); }
          }}
        />
        {tools}
      </div>
      {working && !text.trim() ? (
        <button className="btn stop" type="button" onClick={() => void stop()} title="Stop (sends Esc)"><Icon name="stop" /> Stop</button>
      ) : (
        <button className="btn primary send" type="submit" disabled={sending || (blocked && !text.trim()) || (!text.trim() && !files.length)}>Send</button>
      )}
      {files.length || error ? (
        <div className="files" style={{ gridColumn: "1 / -1" }}>
          {files.map((file) => (
            <span key={file} className={previews[file] ? "chip thumb" : "chip"}>
              {previews[file] ? <img src={previews[file]} alt="" /> : <Icon name="attach" />}
              <span className="chip-name">{file.split("/").pop()}</span>
              <button type="button" className="chip-x" aria-label="Remove attachment" onClick={() => setFiles((current) => current.filter((item) => item !== file))}>×</button>
            </span>
          ))}
          {error ? <span className="err">{error}</span> : null}
        </div>
      ) : null}
    </form>
  );
}

type Tab = "chat" | "team" | "changes" | "files" | "setup";

/** The main surface: who you are talking to, then Chat / Changes / Files / Setup. */
export function ChatPanel({ paneId, onShowFloor, detailsOpen, onDetails }: { paneId: string; onShowFloor?: () => void; detailsOpen?: boolean; onDetails?: () => void }) {
  const snap = useOffice();
  const [tab, setTab] = useState<Tab>("chat");
  const [file, setFile] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const agent = snap.office?.agents.find((item) => item.paneId === paneId);
  const project = snap.office?.projects.find((item) => item.workspaceId === agent?.workspaceId);
  const page = snap.conversations[paneId];
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const since = useWorkingSince(agent);
  const context = useAgentContext(paneId);
  const [removing, setRemoving] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: switching Agent resets the tab
  useEffect(() => { setTab("chat"); setFile(null); setOutbox([]); }, [paneId]);
  useEffect(() => {
    if (!outbox.length) return;
    const timer = setTimeout(() => setOutbox((list) => list.filter((out) => Date.now() - out.at < 90_000)), 5000);
    return () => clearTimeout(timer);
  }, [outbox]);
  // Paths the Agent mentions link only when they exist in its folder; a click opens them in Files.
  const repoFiles = useRepoFiles(paneId).data ?? NO_FILES;
  const fuel = useFuel();
  const resolvePath = useMemo(() => pathResolver(repoFiles, context?.git?.root ?? agent?.cwd), [repoFiles, context?.git?.root, agent?.cwd]);
  const openPath = useCallback((relative: string) => { setFile(relative || "/"); setTab("files"); }, []);
  openFileHook.current = (path: string) => { setFile(path); setTab("changes"); };
  if (!agent) return <div className="conv"><div className="empty"><h2>That Agent left the Floor</h2><p>Pick another one on the left.</p></div></div>;
  const color = project?.projectColor ?? "#94a3b8";
  const git = context?.git;
  // Header facts: add a line here to show more about the Agent.
  const facts: Array<{ key: string; node: ReactNode; title?: string }> = [
    { key: "project", node: <><i className="swatch" style={{ "--pc": color } as CSSProperties} /><span className="fact-label">{project?.label ?? agent.workspaceId}</span></>, title: agent.cwd },
    ...(git?.branch ? [{ key: "branch", node: <span className="mono"><Icon name="branch" /> {git.branch}{git.ahead ? ` ↑${git.ahead}` : ""}{git.behind ? ` ↓${git.behind}` : ""}</span>, title: git.upstream }] : []),
    ...(git?.changes.length ? [{ key: "changes", node: <span className="mono"><span className="add">+{git.added}</span> <span className="del">−{git.removed}</span> · {git.changes.length} files</span> }] : []),
  ];
  return (
    <section className="conv" aria-label={`Conversation with ${agent.name}`}>
      <header className="conv-head">
        <Portrait color={color} name={agent.name} skin={agent.skin} large />
        <div className="agent-identity">
          <div className="name-row">
            <span className="name" title={agent.name}>{agent.name}</span>
            <span className={`state-pill ${agent.status}`} style={{ "--c": statusColor(agent.status) } as CSSProperties}>
              {statusText(agent.status)}{agent.status === "blocked" ? ` · ${waiting(agent.waitingSince, serverNow())}` : agent.status === "working" && agent.stage ? ` · ${agent.stage}` : ""}
            </span>
            <LowFuel agent={agent} />
            {agent.task ? <span className="agent-task" title={agent.task}>{agent.task}</span> : null}
          </div>
          <div className="facts-row">
            {facts.map((fact) => <span key={fact.key} className={`fact fact-${fact.key}`} title={fact.title}>{fact.node}</span>)}
          </div>
        </div>
        <div className="head-health"><HealthBars fuel={context?.fuel ?? fuel[paneId]} /></div>
        <div className="actions">
          {onDetails ? <button type="button" className={`icon-ghost details-toggle${detailsOpen ? " on" : ""}`} title="Details" aria-label="Details" aria-pressed={detailsOpen} onClick={onDetails}>Details</button> : null}
          {onShowFloor ? <button type="button" className="icon-ghost" title="Show on Floor" aria-label="Show on Floor" onClick={onShowFloor}><Icon name="show-on-floor" /></button> : null}
          <button type="button" className="icon-ghost" title="Open in Orcha" aria-label="Open in Orcha" onClick={() => void api(`/api/agents/${encodeURIComponent(agent.paneId)}/focus`, { method: "POST" })}><Icon name="open-in-orcha" /></button>
          <HeadMenu onDetails={onDetails} onSetup={() => setTab("setup")} onRemove={() => setRemoving(true)} />
        </div>
      </header>
      <nav className="conv-tabs" aria-label="Agent views">
        {(["chat", "team", "changes", "files", "setup"] as Tab[]).map((item) => (
          <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>
      {tab === "chat" ? (
        <>
          <MessageList items={page?.items ?? []} terminal={page?.terminal ?? false} agent={{ name: agent.name, skin: agent.skin, color, paneId: agent.paneId }} outbox={outbox} working={agent.status === "working" ? { stage: agent.stage, since } : null} onEdit={(text) => { drafts.set(paneId, text); setComposerKey((n) => n + 1); }} onOpenPath={openPath} resolvePath={resolvePath} />
          <div className="dock">
            {snap.pending?.paneId === paneId && snap.pending.note !== "sent…" ? <span className="pending">{snap.pending.note}</span> : null}
            <QuestionCard paneId={paneId} />
            <Composer key={`${paneId}:${composerKey}`} agent={agent} tools={<AgentPills agent={agent} fuel={context?.fuel ?? fuel[paneId]} />} onSent={(text) => setOutbox((list) => [...list, { id: `${Date.now()}`, text, at: serverNow() }])} />
          </div>
        </>
      ) : tab === "team" ? (<TeamView key={agent.workspaceId} agent={agent}/>) : tab === "setup" ? (
        <SetupView agent={agent} project={project} onCloseProject={() => setClosing(true)} />
      ) : (
        <FilesView paneId={paneId} mode={tab} initial={file} />
      )}
      {closing && project ? <CloseProject project={project} close={() => setClosing(false)} /> : null}
      {removing ? <RemoveAgent agent={agent} close={() => setRemoving(false)} /> : null}
    </section>
  );
}

const NO_FILES: string[] = [];

const workingSince = new Map<string, number>();
/** When this Agent started its current working stretch, as seen by this browser. */
function useWorkingSince(agent: Agent | undefined): number {
  if (!agent) return Date.now();
  if (agent.status !== "working") { workingSince.delete(agent.paneId); return Date.now(); }
  const known = workingSince.get(agent.paneId);
  if (known) return known;
  const now = Date.now();
  workingSince.set(agent.paneId, now);
  return now;
}

function HeadMenu({ onSetup, onRemove, onDetails }: { onSetup: () => void; onRemove: () => void; onDetails?: () => void }) {
  return (
    <Menu label="Agent menu" triggerClass="icon-ghost">
      {onDetails ? <MenuItem onSelect={onDetails}>Details</MenuItem> : null}
      <MenuItem onSelect={onSetup}>Rename, skin, setup…</MenuItem>
      <MenuSeparator />
      <MenuItem danger onSelect={onRemove}>Remove agent</MenuItem>
    </Menu>
  );
}

function RemoveAgent({ agent, close }: { agent: Agent; close: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={close}>
      <form className="panel" onSubmit={(event) => {
        event.preventDefault();
        void api(`/api/agents/${encodeURIComponent(agent.paneId)}/close`, { method: "POST" })
          .then(close)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not remove"));
      }}>
        <ModalTitle>Remove {agent.name}</ModalTitle>
        <p>This closes its pane in Orcha and stops the agent. HR carries it out of the Floor.</p>
        {error ? <p className="err">{error}</p> : null}
        <div className="row">
          <button className="btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="btn danger" type="submit">Remove</button>
        </div>
      </form>
    </Modal>
  );
}

/** Lets the context panel open a changed file in this chat's Changes tab. */
export const openFileHook: { current: (path: string) => void } = { current: () => undefined };

/** Closing a Project closes its Orcha workspace and every pane in it, so the name must be typed first. */
export function CloseProject({ project, close }: { project: { workspaceId: string; label: string }; close: () => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={close}>
      <form className="panel" onSubmit={(event) => {
        event.preventDefault();
        void api(`/api/projects/${encodeURIComponent(project.workspaceId)}/close`, { method: "POST", body: JSON.stringify({ confirm: typed }) })
          .then(close)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not close"));
      }}>
        <ModalTitle>Close project</ModalTitle>
        <p>This closes <b>{project.label}</b> in Orcha: every agent and terminal in it stops. It cannot be undone from here.</p>
        <label>Type the project name to confirm <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={project.label} aria-label="Project name" /></label>
        {error ? <p className="err">{error}</p> : null}
        <div className="row">
          <button className="btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="btn danger" type="submit" disabled={typed.trim() !== project.label}>Close project</button>
        </div>
      </form>
    </Modal>
  );
}
