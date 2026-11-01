import type { AccountInfo } from "@easy-job/shared";
import { ActionError } from "./actions.ts";
import type { OfficeLink } from "./orcha/link.ts";
import type { ActivityLog } from "./state/activity.ts";

const LOGIN: Record<string, string> = {
  claude: "claude auth login",
  codex: "codex login",
  cursor: "cursor-agent login",
};

function quote(value: string): string {
  return /^[\w./~:-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

export function loginLine(account: AccountInfo): string {
  const command = LOGIN[account.kind] ?? LOGIN.claude;
  if (account.kind === "claude" && account.dir) return `CLAUDE_CONFIG_DIR=${quote(account.dir)} ${command ?? "claude auth login"}`;
  return command ?? "claude auth login";
}

/** A new Orcha tab, not focused, running the account's sign-in command. */
export async function startSignIn(input: {
  link: OfficeLink;
  account: AccountInfo;
  activity: ActivityLog;
}): Promise<{ paneId: string }> {
  const state = input.link.state();
  const same = state.agents.find((agent) => agent.kind === input.account.kind);
  const project = state.projects.find((item) => item.workspaceId === same?.workspaceId) ?? state.projects[0];
  if (!project) throw new ActionError(404, "No Project to sign in from");
  const created = (await input.link.request("tab.create", {
    workspace_id: project.workspaceId,
    cwd: project.cwd,
    focus: false,
  })) as { root_pane?: { pane_id?: string } };
  const paneId = created.root_pane?.pane_id;
  if (!paneId) throw new ActionError(502, "Orcha did not return a pane");
  await input.link.request("pane.send_input", { pane_id: paneId, text: loginLine(input.account), keys: ["enter"] });
  input.activity.append({ kind: "action", text: `Sign in ${input.account.label}`, paneId, workspaceId: project.workspaceId });
  return { paneId };
}
