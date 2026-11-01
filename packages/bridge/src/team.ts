import type { ConversationItem } from "@easy-job/shared";

export type ThreadItem = ConversationItem & { paneId: string; from?: string };

const HANDOFF_TOOL = /(?:herdr|orcha) agent prompt\s+(\S+)/i;

/** More than one target gets a one-line header. A single target is the text alone. */
export function ownerPrompt(text: string, names: string[]): string {
  if (names.length < 2) return text;
  return `From the Owner, also sent to: ${names.join(", ")}\n\n${text}`;
}

/**
 * One timeline for a Project, oldest first.
 * `from` is set when another Agent's latest tool call asked Orcha to prompt this pane.
 */
export function mergeThread(
  groups: Array<{ paneId: string; name: string; items: ConversationItem[] }>,
  query: { before?: string; limit?: number } = {},
): ThreadItem[] {
  const limit = query.limit ?? 100;
  const flat: ThreadItem[] = [];
  for (const group of groups) {
    for (const item of group.items) flat.push({ ...item, paneId: group.paneId });
  }
  flat.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const cut = query.before ? flat.findIndex((item) => item.id === query.before) : flat.length;
  const page = flat.slice(Math.max(0, (cut < 0 ? flat.length : cut) - limit), cut < 0 ? flat.length : cut);
  for (const item of page) {
    if (item.role !== "user") continue;
    const source = sender(groups, item);
    if (source) item.from = source;
  }
  return page;
}

function sender(groups: Array<{ paneId: string; name: string; items: ConversationItem[] }>, item: ThreadItem): string | undefined {
  let found: { paneId: string; at: number } | undefined;
  for (const group of groups) {
    if (group.paneId === item.paneId) continue;
    const tools = group.items.filter((entry) => entry.role === "tool" && entry.at <= item.at);
    const last = tools.at(-1);
    const summary = `${last?.tool?.name ?? ""} ${last?.tool?.summary ?? ""}`;
    const match = summary.match(HANDOFF_TOOL);
    if (!match || !last) continue;
    const target = match[1] ?? "";
    const named = groups.find((entry) => entry.paneId === item.paneId);
    if (target !== item.paneId && target !== named?.name) continue;
    if (!found || last.at >= found.at) found = { paneId: group.paneId, at: last.at };
  }
  return found?.paneId;
}
