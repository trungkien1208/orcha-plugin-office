import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { common, createLowlight } from "lowlight";
import { useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import "./code-view.css";

// The same highlight.js grammars the chat already uses (via rehype-highlight); bundled, no network.
const lowlight = createLowlight(common);
const LANGUAGE: Record<string, string> = { tsx: "typescript", jsx: "javascript", mjs: "javascript", cjs: "javascript", yml: "yaml", md: "markdown", rs: "rust", py: "python", sh: "bash", zsh: "bash", html: "xml", svg: "xml" };
const HIGHLIGHT_LIMIT = 150_000;

function languageOf(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const name = LANGUAGE[ext] ?? ext;
  return lowlight.registered(name) ? name : undefined;
}

/** A file with line numbers and syntax colours (plain text past ~150 KB or for unknown types). */
export function CodeView({ path, text }: { path: string; text: string }) {
  const body = useMemo(() => {
    const language = languageOf(path);
    if (!language || text.length > HIGHLIGHT_LIMIT) return text;
    return toJsxRuntime(lowlight.highlight(language, text), { Fragment, jsx, jsxs });
  }, [path, text]);
  const lines = useMemo(() => text.split("\n").length, [text]);
  return (
    <div className="viewer code-view">
      <pre className="gutter" aria-hidden="true">{Array.from({ length: lines }, (_, index) => index + 1).join("\n")}</pre>
      <pre className="code-text hljs">{body}</pre>
    </div>
  );
}

/** A git diff as hunks with old/new line numbers. */
export function DiffView({ text }: { text: string }) {
  const files = useMemo(() => {
    try { return parseDiff(text); } catch { return []; }
  }, [text]);
  if (!files.length) return <pre className="viewer">{text || "No changes."}</pre>;
  return (
    <div className="viewer diff-view">
      {files.map((file) => (
        <Diff key={`${file.oldRevision}-${file.newRevision}-${file.newPath}`} viewType="unified" diffType={file.type} hunks={file.hunks}>
          {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
        </Diff>
      ))}
    </div>
  );
}
