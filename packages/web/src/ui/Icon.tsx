import { useEffect, useState } from "react";

/** Text glyphs used until the pixel sheets (icons-ui, icons-ui2) have the icon. */
const GLYPH: Record<string, string> = {
  search: "⌕", settings: "⚙", bell: "🔔", "sound-on": "🔊", "sound-off": "🔇", send: "➤", attach: "📎", close: "✕", menu: "☰",
  "chevron-left": "◂", "chevron-right": "▸", expand: "⤢", "open-in-orcha": "↗", "show-on-floor": "▦", remove: "✕",
  "close-project": "✕", "new-agent": "+", "new-project": "▦", filter: "⏷", rec: "●", tool: "🔧", pencil: "✎",
  "key-enter": "⏎", "key-esc": "Esc", branch: "⎇", commit: "◉", worktree: "⑂", file: "▤", folder: "▣", diff: "±",
  fuel: "⛽", warning: "⚠", check: "✓", cross: "✗", push: "↑", pull: "↓",
  "caret-down": "▾", "caret-right": "▸", more: "⋯", copy: "⧉", stop: "■", resume: "▶", "jump-latest": "↓", pin: "⌖",
  "tool-bash": "⌘", "tool-read": "◱", "tool-edit": "✎", "tool-write": "＋", "tool-grep": "⌕", "tool-web": "◍",
  "tool-task": "⧉", "tool-todo": "☑", thinking: "…", clock: "◷", heart: "♥", bolt: "⚡", boss: "☻", image: "▨",
  skill: "/", shell: "!", retry: "↻", hourglass: "⧗", lock: "🔒", crown: "♛", "theme-office": "☕", "theme-compound": "⛓",
  sun: "☀", moon: "☾", keyboard: "⌨", help: "?",
};

type Sheet = { src: string; order: string[]; columns: number };
let sheets: Sheet[] | null = null;
let loading: Promise<Sheet[]> | null = null;

/** Reads the icon order from the office manifest once; sheets Codex has not drawn yet are skipped. */
function loadSheets(): Promise<Sheet[]> {
  loading ??= fetch("/office/manifest.json")
    .then((response) => (response.ok ? response.json() : {}))
    .then((manifest: { ui?: Record<string, string>; layout?: Record<string, { order?: string[]; columns?: number }> }) => {
      const pick = (layoutKey: string, file: string): Sheet[] => {
        const order = manifest.layout?.[layoutKey]?.order, path = Object.values(manifest.ui ?? {}).find((value) => value.endsWith(`/${file}`));
        return order && path ? [{ src: `/${path}`, order, columns: manifest.layout?.[layoutKey]?.columns ?? 7 }] : [];
      };
      sheets = [...pick("iconsUi", "icons-ui-16.png"), ...pick("iconsUi2", "icons-ui2-16.png")];
      return sheets;
    })
    .catch(() => (sheets = []));
  return loading;
}

/** A 16 px pixel icon from the office art by name (see layout.iconsUi.order), else a text glyph. Decorative unless labelled. */
export function Icon({ name, label, className }: { name: string; label?: string; className?: string }) {
  const [ready, setReady] = useState(sheets);
  useEffect(() => { if (!ready) void loadSheets().then(setReady); }, [ready]);
  const sheet = ready?.find((item) => item.order.includes(name));
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  if (!sheet) return <span className={`icon glyph ${className ?? ""}`} {...a11y}>{GLYPH[name] ?? "•"}</span>;
  const index = sheet.order.indexOf(name);
  return (
    <span
      className={`icon ${className ?? ""}`}
      {...a11y}
      style={{ backgroundImage: `url(${sheet.src})`, backgroundPosition: `-${(index % sheet.columns) * 16}px -${Math.floor(index / sheet.columns) * 16}px` }}
    />
  );
}
