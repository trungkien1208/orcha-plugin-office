import { useEffect, useMemo, useState } from "react";
import { useRepoFiles } from "../queries.ts";
import type { GitChange } from "@easy-job/shared";
import { api } from "../api.ts";
import { Icon } from "../ui/Icon.tsx";
import { useAgentContext } from "./Context.tsx";
import { ancestors, buildTree, findDir, type FileNode } from "./file-tree.ts";
import "./files.css";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { isImagePath } from "./paths.ts";
import { CodeView, DiffView } from "./CodeView.tsx";
import { AuthImage } from "../ui/AuthImage.tsx";

const STATUS_CLASS: Record<string, string> = { M: "mod", A: "add", D: "del", R: "mod" };
const SEARCH_LIMIT = 300;
const NO_CHANGES: GitChange[] = [];
type Target = { kind: "file" | "dir"; path: string };
type Body = { path: string; text: string; truncated?: boolean } | null;

const baseName = (at: string) => at.split("/").pop() || at;
const dirName = (at: string) => at.split("/").slice(0, -1).join("/");

/** Changes and Files tabs: a list on the left (folder tree, changed files, or search hits), the selection on the right. */
export function FilesView({ paneId, mode, initial }: { paneId: string; mode: "changes" | "files"; initial?: string | null }) {
  const data = useAgentContext(paneId);
  const base = `/api/agents/${encodeURIComponent(paneId)}`;
  const filesQuery = useRepoFiles(paneId, mode === "files");
  const files = mode === "files" ? (filesQuery.data ?? (filesQuery.isError ? [] : null)) : null;
  const failed = filesQuery.error instanceof Error ? filesQuery.error.message : "";
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<Target | null>(mode === "files" ? { kind: "dir", path: "" } : null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const changes = data?.git?.changes ?? NO_CHANGES;
  const changeOf = useMemo(() => new Map(changes.map((change) => [change.path, change])), [changes]);
  const tree = useMemo(() => buildTree(files ?? [], new Set(changeOf.keys())), [files, changeOf]);

  // Open what the chat or the context panel asked for once the list is known: a folder as its listing, else a file.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the request or the loaded list changes only
  useEffect(() => {
    if (!initial) return;
    const at = initial.replace(/^\/$/, "").replace(/\/+$/, "");
    if (mode === "files" && !files) return;
    if (mode === "files" && (at === "" || findDir(tree, at))) openDir(at);
    else { setTarget({ kind: "file", path: at }); setExpanded((set) => new Set([...set, ...ancestors(dirName(at))])); }
  }, [initial, files, mode]);

  const openFile = (at: string) => setTarget({ kind: "file", path: at });
  const openDir = (at: string) => {
    setTarget({ kind: "dir", path: at });
    setExpanded((set) => new Set([...set, ...ancestors(at)]));
  };

  const needle = query.trim().toLowerCase();
  const hits = needle ? (files ?? []).filter((file) => file.toLowerCase().includes(needle)) : [];

  return (
    <div className="files-view">
      <div className="files-side">
        {mode === "files" ? (
          <div className="files-search">
            <input className="search" placeholder={files ? `Search ${files.length}${files.length >= 5000 ? "+" : ""} files` : "Loading files…"} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search files" />
          </div>
        ) : null}
        <div className="files-list">
          {mode === "changes"
            ? changes.map((change) => <FlatRow key={change.path} at={change.path} change={change} selected={target?.path === change.path} onOpen={openFile} />)
            : needle
              ? hits.slice(0, SEARCH_LIMIT).map((file) => <FlatRow key={file} at={file} change={changeOf.get(file)} selected={target?.path === file} onOpen={openFile} />)
              : <FolderTree tree={tree} expanded={expanded} setExpanded={setExpanded} target={target} onFile={openFile} onDir={openDir} />}
          {needle && hits.length > SEARCH_LIMIT ? <p className="muted files-note">{hits.length - SEARCH_LIMIT} more, refine the search.</p> : null}
          {needle && !hits.length ? <p className="muted files-note">No files match “{query}”.</p> : null}
          {mode === "changes" && !changes.length ? <p className="muted files-note">{data?.git ? "Working tree clean." : "Not a git repository."}</p> : null}
          {mode === "files" && files && !files.length ? <p className="muted files-note">{failed || "No files."}</p> : null}
        </div>
      </div>
      <Viewer base={base} mode={mode} target={target} tree={tree} changeOf={changeOf} onFile={openFile} onDir={openDir} />
    </div>
  );
}

const ROOT = "/";

/**
 * The folder tree. @headless-tree turns the nested folders into a flat, accessible list and handles expand/collapse
 * and arrow-key navigation; this only renders rows. A click on a folder opens its listing as well as toggling it.
 */
function FolderTree({ tree, expanded, setExpanded, target, onFile, onDir }: {
  tree: FileNode; expanded: Set<string>; setExpanded: (update: (set: Set<string>) => Set<string>) => void; target: Target | null; onFile: (at: string) => void; onDir: (at: string) => void;
}) {
  const nodes = useMemo(() => {
    const map = new Map<string, FileNode>();
    const walk = (node: FileNode) => { map.set(node.path || ROOT, node); for (const child of node.children) walk(child); };
    walk(tree);
    return map;
  }, [tree]);
  const [focused, setFocused] = useState<string | null>(null);
  // Stable arrays in, and only real changes out: the tree syncs controlled state and would loop on fresh copies.
  const expandedItems = useMemo(() => [...expanded], [expanded]);
  const view = useTree<FileNode>({
    rootItemId: ROOT,
    state: { expandedItems, focusedItem: focused },
    setExpandedItems: (update) => setExpanded((set) => {
      const next = typeof update === "function" ? update([...set]) : update;
      return next.length === set.size && next.every((id) => set.has(id)) ? set : new Set(next);
    }),
    setFocusedItem: setFocused,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().dir,
    onPrimaryAction: (item) => { const node = item.getItemData(); if (node.dir) onDir(node.path); else onFile(node.path); },
    dataLoader: {
      getItem: (id) => nodes.get(id) ?? { name: id, path: id, dir: false, children: [], files: 0, changed: 0 },
      getChildren: (id) => (nodes.get(id)?.children ?? []).map((child) => child.path),
    },
    indent: 14,
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new file list changes the tree the instance caches
  useEffect(() => view.rebuildTree(), [nodes]);
  return (
    <div {...view.getContainerProps("Files")} className="file-tree">
      {view.getItems().map((item) => {
        const node = item.getItemData();
        const selected = target?.path === node.path && target.kind === (node.dir ? "dir" : "file");
        return (
          <div {...item.getProps()} key={item.getId()} className={`file-row${selected ? " sel" : ""}${node.dir ? " is-dir" : ""}${item.isFocused() ? " focus" : ""}`} style={{ paddingLeft: 6 + item.getItemMeta().level * 14 }}>
            <span className="file-caret" aria-hidden="true">{node.dir ? <Icon name={item.isExpanded() ? "caret-down" : "caret-right"} /> : null}</span>
            <span className="file-name" title={node.path}><span>{node.name}</span></span>
            {node.changed ? <i className="file-changed" title={`${node.changed} changed`} /> : null}
            {node.dir ? <span className="file-count">{node.files}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function FlatRow({ at, change, selected, onOpen }: { at: string; change?: GitChange; selected: boolean; onOpen: (at: string) => void }) {
  return (
    <button type="button" aria-current={selected || undefined} className={`file-row flat${selected ? " sel" : ""}`} title={at} onClick={() => onOpen(at)}>
      {change ? <b className={`file-status ${STATUS_CLASS[change.status] ?? "mod"}`}>{change.status}</b> : <span className="file-status" />}
      <span className="file-flat"><span>{baseName(at)}</span><small>{dirName(at)}</small></span>
      {change && (change.add || change.del) ? <span className="file-delta"><span className="add">+{change.add}</span> <span className="del">−{change.del}</span></span> : null}
    </button>
  );
}

function Viewer({ base, mode, target, tree, changeOf, onFile, onDir }: {
  base: string; mode: "changes" | "files"; target: Target | null; tree: FileNode; changeOf: Map<string, GitChange>; onFile: (at: string) => void; onDir: (at: string) => void;
}) {
  const changed = target?.kind === "file" && changeOf.has(target.path);
  const [view, setView] = useState<"file" | "diff">(mode === "changes" ? "diff" : "file");
  const [body, setBody] = useState<Body>(null);
  const [error, setError] = useState("");
  const showDiff = changed && view === "diff";

  useEffect(() => { setView(mode === "changes" ? "diff" : "file"); }, [mode]);
  useEffect(() => {
    setBody(null); setError("");
    if (target?.kind !== "file" || (isImagePath(target.path) && !showDiff)) return;
    let live = true;
    const request = showDiff
      ? api<{ diff: string }>(`${base}/diff?path=${encodeURIComponent(target.path)}`).then((value) => ({ path: target.path, text: value.diff }))
      : api<{ text: string; truncated: boolean }>(`${base}/file?path=${encodeURIComponent(target.path)}`).then((value) => ({ path: target.path, text: value.text, truncated: value.truncated }));
    void request.then((value) => { if (live) setBody(value); }).catch((err: unknown) => { if (live) setError(err instanceof Error ? err.message : "Could not open the file"); });
    return () => { live = false; };
  }, [base, target?.kind, target?.path, showDiff]);

  if (!target) return <div className="viewer-pane"><p className="viewer-empty muted">Pick a file.</p></div>;
  const crumbs = ancestors(target.path);
  const lines = body && !showDiff ? body.text.split("\n") : [];
  const dir = target.kind === "dir" ? findDir(tree, target.path) : undefined;
  return (
    <div className="viewer-pane">
      <div className="viewer-head">
        <nav className="crumbs" aria-label="Path">
          <button type="button" onClick={() => onDir("")}>root</button>
          {crumbs.map((at, index) => (
            <span key={at}>
              <i aria-hidden="true">/</i>
              {index === crumbs.length - 1 && target.kind === "file" ? <b>{baseName(at)}</b> : <button type="button" onClick={() => onDir(at)}>{baseName(at)}</button>}
            </span>
          ))}
        </nav>
        <span className="viewer-meta">
          {dir ? `${dir.children.length} items · ${dir.files} files` : body && !showDiff ? `${lines.length} lines${body.truncated ? " · first 200 KB" : ""}` : ""}
        </span>
        {changed ? (
          <span className="viewer-switch">
            <button type="button" aria-pressed={view === "file"} onClick={() => setView("file")}>File</button>
            <button type="button" aria-pressed={view === "diff"} onClick={() => setView("diff")}>Diff</button>
          </span>
        ) : null}
        {target.kind === "file" ? <button type="button" className="viewer-copy" title="Copy path" aria-label="Copy path" onClick={() => void navigator.clipboard?.writeText(target.path)}><Icon name="copy" /></button> : null}
      </div>
      {target.kind === "dir" ? (
        dir ? (
          <div className="dir-list">
            {dir.children.map((child) => (
              <button key={child.path} type="button" className="dir-item" onClick={() => (child.dir ? onDir(child.path) : onFile(child.path))}>
                <span className={child.dir ? "dir-name is-dir" : "dir-name"}>{child.name}{child.dir ? "/" : ""}</span>
                {child.changed ? <i className="file-changed" title={`${child.changed} changed`} /> : null}
                <small>{child.dir ? `${child.files} files` : changeOf.get(child.path)?.status ?? ""}</small>
              </button>
            ))}
            {!dir.children.length ? <p className="viewer-empty muted">Empty folder.</p> : null}
          </div>
        ) : <p className="viewer-empty muted">This folder is not in the list.</p>
      ) : isImagePath(target.path) && !showDiff ? (
        <div className="viewer-image"><AuthImage key={target.path} src={`${base}/raw?path=${encodeURIComponent(target.path)}`} alt={baseName(target.path)} large /></div>
      ) : error ? <p className="viewer-empty err">{error}</p>
        : !body ? <p className="viewer-empty muted">Loading…</p>
        : showDiff ? <DiffView text={body.text} />
        : <CodeView path={body.path} text={body.text} />}
    </div>
  );
}
