import {
  agentKinds,
  answerAgent,
  broadcast,
  focusAgent,
  focusProject,
  interruptAgent,
  closeAgent,
  closeProject,
  createProject,
  markSeen,
  promptAgent,
  readQuestion,
  readTerminal,
  renameAgent,
  sendKeys,
  setSkin,
  startAgent,
  ActionError,
  orchaUnreachable,
} from "../actions.ts";
import { defaultAccountRoots, readOfficeAccounts, type AccountRoots } from "../accounts.ts";
import { requestModel } from "../model-queue.ts";
import { listModels } from "../models.ts";
import { currentModelState } from "../orcha/model-state.ts";
import { runHandoff } from "../handoff.ts";
import { startSignIn } from "../sign-in.ts";
import { mergeThread, ownerPrompt } from "../team.ts";
import { describeSwitch, switchAccount } from "../switch.ts";
import { orchaHandoff, orchaLogin, orchaPlan, orchaQuestion, orchaSwitch } from "../orcha/v24.ts";
import type { StructuredQuestion } from "@easy-job/shared";
import { locateTranscript, readTranscript, type TranscriptQuery } from "../conversation/load.ts";
import { terminalConversation } from "../conversation/terminal.ts";
import type { OfficeLink } from "../orcha/link.ts";
import { listSkills } from "../skills.ts";
import type { ActivityLog } from "../state/activity.ts";
import { saveUpload, uploadFile } from "../uploads.ts";
import type { ConversationItem } from "@easy-job/shared";
import fs from "node:fs";
import { z } from "zod";
import { fileDiff, fuelFor, gitContext, gitRoot, listFiles, readRepoFile, repoImage, walkFiles } from "../context.ts";

const promptBody = z.object({ text: z.string().min(1), attachments: z.array(z.string()).optional() });
const keysBody = z.object({ keys: z.array(z.string()).min(1) });
const textBody = z.object({ text: z.string().min(1) });
const answerBody = z
  .object({ text: z.string().min(1).optional(), option: z.string().min(1).optional(), options: z.array(z.string().min(1)).min(1).optional() })
  .refine((body) => [body.text, body.option, body.options].filter((value) => value !== undefined).length === 1, "Give text, option or options");
const nameBody = z.object({ name: z.string().min(1).max(80) });
const skinBody = z.object({ skin: z.string().min(1) });
const startBody = z.object({
  kind: z.string().min(1),
  name: z.string().max(80).optional(),
  prompt: z.string().optional(),
  model: z.string().max(80).regex(/^[\w.:/-]*$/).optional(),
  effort: z.string().max(20).optional(),
  fast: z.boolean().optional(),
});

const rootsOf = (deps: RouteDeps) => deps.accountRoots ?? defaultAccountRoots();

export type RouteDeps = {
  link: OfficeLink;
  activity: ActivityLog;
  home?: string;
  /** Orcha config, fuel cache, and home. Tests pass a temp folder. */
  accountRoots?: AccountRoots;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function fail(error: unknown): Response {
  if (error instanceof ActionError) return json({ error: error.message }, error.status);
  if (orchaUnreachable(error)) return json({ error: "Orcha isn't answering" }, 503);
  if (error instanceof z.ZodError) return json({ error: "Invalid request" }, 400);
  console.error(error instanceof Error ? error.message : error);
  return json({ error: "Something went wrong" }, 500);
}

function pageTranscript(items: ConversationItem[], query: TranscriptQuery): ConversationItem[] {
  if (query.before) {
    const index = items.findIndex((item) => item.id === query.before);
    const stop = index < 0 ? items.length : index;
    return items.slice(Math.max(0, stop - 100), stop);
  }
  if (query.after) {
    const index = items.findIndex((item) => item.id === query.after);
    return index < 0 ? items.slice(-100) : items.slice(index + 1, index + 101);
  }
  return items.slice(-100);
}

function pane(url: URL): string {
  const parts = url.pathname.split("/");
  const index = parts.indexOf("agents");
  return decodeURIComponent(parts[index + 1] ?? "");
}

function workspace(url: URL): string {
  const parts = url.pathname.split("/");
  const index = parts.indexOf("projects");
  return decodeURIComponent(parts[index + 1] ?? "");
}

export function conversationFor(
  deps: RouteDeps,
  paneId: string,
  query: TranscriptQuery = {},
): { items: ConversationItem[]; terminal: boolean } {
  const agent = deps.link.state().agents.find((item) => item.paneId === paneId);
  if (!agent) return { items: [], terminal: false };
  const hit = locateTranscript({
    kind: agent.kind,
    cwd: agent.cwd,
    session: agent.session?.value,
    transcriptPath: agent.session?.transcript_path,
  });
  if (hit.kind === "missing") return { items: [], terminal: true };
  const items = readTranscript(hit, query);
  if (!items.length && !query.before && !query.after) return { items: [], terminal: true };
  return { items, terminal: false };
}

export function findOnPath(name: string, pathEnv = process.env.PATH ?? ""): string | undefined {
  return pathEnv.split(":").map((dir) => `${dir}/${name}`).find((file) => file.length > name.length + 1 && fs.existsSync(file));
}

/** Start Orcha's headless server. The link reconnects when the socket appears. */
export function startOrchaServer(pathEnv = process.env.PATH ?? ""): { started: boolean; message: string } {
  const orcha = findOnPath("orcha", pathEnv);
  if (!orcha) return { started: false, message: "Orcha is not installed. See `easy-job doctor`." };
  const child = Bun.spawn([orcha, "server"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  child.unref();
  return { started: true, message: "Starting Orcha…" };
}

export async function handleApi(req: Request, deps: RouteDeps): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/api/state") return json(deps.link.state());
    if (req.method === "GET" && path === "/api/activity") {
      const before = Number(url.searchParams.get("before") ?? "");
      return json(deps.activity.recent(100, Number.isFinite(before) && before > 0 ? before : undefined));
    }
    if (req.method === "GET" && path === "/api/skills") {
      const agent = deps.link.state().agents.find((item) => item.paneId === url.searchParams.get("pane"));
      return json(await listSkills(agent?.cwd, agent?.kind));
    }
    if (req.method === "GET" && path === "/api/kinds") return json(await agentKinds(deps.link));
    if (req.method === "GET" && path === "/api/models") return json(await listModels(url.searchParams.get("kind") ?? "", deps.link));
    if (req.method === "GET" && path.startsWith("/api/agents/") && path.endsWith("/model-state")) return json(await currentModelState(deps.link,pane(url),deps.accountRoots?.home));
    if (req.method === "GET" && path === "/api/fuel") {
      const agents = deps.link.state().agents;
      const entries = await Promise.all(agents.map(async (agent) => [agent.paneId, await fuelFor(deps.link, agent)] as const));
      return json({ byPane: Object.fromEntries(entries) });
    }
    if (req.method === "GET" && path.startsWith("/api/agents/") && /\/(context|files|file|diff|raw)$/.test(path)) {
      const agent = deps.link.state().agents.find((item) => item.paneId === pane(url));
      if (!agent) return json({ error: "No such Agent" }, 404);
      if (path.endsWith("/context")) return json({ git: await gitContext(agent.cwd), fuel: await fuelFor(deps.link, agent) });
      const repo = await gitRoot(agent.cwd);
      const root = repo ?? agent.cwd;
      if (!root || !fs.existsSync(root)) return json({ error: "No folder for this Agent" }, 404);
      if (path.endsWith("/files")) return json(repo ? await listFiles(root) : await walkFiles(root));
      const file = url.searchParams.get("path") ?? "";
      if (path.endsWith("/diff")) return json({ path: file, diff: repo ? await fileDiff(root, file) : "" });
      if (path.endsWith("/raw")) {
        const image = repoImage(root, file);
        // SVG can carry script; serve it as an image with a sandboxing CSP so it never runs as a page.
        return image ? new Response(Bun.file(image.file), { headers: { "content-type": image.type, "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } }) : json({ error: "No such image" }, 404);
      }
      const content = readRepoFile(root, file);
      return content ? json(content) : json({ error: "No such file" }, 404);
    }
    if (req.method === "GET" && path.startsWith("/api/sounds/")) {
      const name = path.endsWith("request.mp3") ? "request.mp3" : path.endsWith("done.mp3") ? "done.mp3" : "";
      if (!name) return json({ error: "Not found" }, 404);
      const file = `${process.env.HOME ?? ""}/.config/herdr/sounds/${name}`;
      if (!fs.existsSync(file)) return json({ error: "Not found" }, 404);
      return new Response(Bun.file(file), { headers: { "content-type": "audio/mpeg" } });
    }
    if (req.method === "POST" && path === "/api/orcha/start") {
      // Start Orcha's headless server in the background; the link reconnects when its socket appears.
      const result = startOrchaServer();
      return json(result, result.started ? 200 : 409);
    }
    if (req.method === "POST" && path === "/api/projects") {
      const body = z.object({
        label: z.string().trim().min(1).max(80),
        cwd: z.string().min(1).max(1024),
        agent: startBody.optional(),
      }).parse(await req.json());
      return json(await createProject(deps.link, body, deps.activity));
    }
    if (req.method === "POST" && path === "/api/uploads") return json(await readUpload(req, deps));
    if (req.method === "GET" && path.startsWith("/api/uploads/")) {
      const id = decodeURIComponent(path.slice("/api/uploads/".length));
      const file = uploadFile(id, deps.home);
      if (!file) return json({ error: "Not found" }, 404);
      return new Response(Bun.file(file));
    }
    if (req.method === "GET" && path === "/api/accounts") {
      return json(await readOfficeAccounts(deps.link, rootsOf(deps)));
    }
    if (req.method === "POST" && path.startsWith("/api/projects/") && path.endsWith("/prompt")) {
      const body = z.object({ to: z.array(z.string().min(1)).min(1).max(5), text: z.string().min(1) }).parse(await req.json());
      const agents = deps.link.state().agents;
      const names = body.to.map((paneId) => agents.find((agent) => agent.paneId === paneId)?.name ?? paneId);
      const text = ownerPrompt(body.text, names);
      const results = [];
      for (const paneId of body.to) {
        try {
          await promptAgent(deps.link, paneId, text, deps.activity);
          results.push({ paneId, ok: true });
        } catch (error) {
          results.push({ paneId, ok: false, error: error instanceof Error ? error.message : "failed" });
        }
      }
      return json({ results });
    }
    if (req.method === "GET" && path.startsWith("/api/projects/") && path.endsWith("/thread")) {
      const id = workspace(url);
      const groups = deps.link.state().agents.filter((agent) => agent.workspaceId === id).map((agent) => ({
        paneId: agent.paneId,
        name: agent.name,
        items: conversationFor(deps, agent.paneId).items,
      }));
      const limit = Number(url.searchParams.get("limit") ?? "");
      return json({ items: mergeThread(groups, { before: url.searchParams.get("before") ?? undefined, limit: Number.isFinite(limit) && limit > 0 ? limit : undefined }) });
    }
    if (req.method === "POST" && path.startsWith("/api/accounts/") && path.endsWith("/login")) {
      const id = decodeURIComponent(path.slice("/api/accounts/".length, -"/login".length));
      const viaOrcha = await orchaLogin(deps.link, id);
      if (viaOrcha) return json(viaOrcha);
      const account = (await readOfficeAccounts(deps.link, rootsOf(deps))).find((item) => item.id === id);
      if (!account) return json({ error: "No such account" }, 404);
      return json(await startSignIn({ link: deps.link, account, activity: deps.activity }));
    }
    if (req.method === "POST" && path.startsWith("/api/agents/") && (path.endsWith("/model") || path.endsWith("/account/plan") || path.endsWith("/account") || path.endsWith("/handoff"))) {
      const agent = deps.link.state().agents.find((item) => item.paneId === pane(url));
      if (!agent) return json({ error: "No such Agent" }, 404);
      if (path.endsWith("/model")) {
        const body = z.object({ model: z.string(), effort: z.string().max(20).optional(), fast: z.boolean().optional() }).parse(await req.json());
        return json(await requestModel(deps.link, agent, body.model, deps.activity, {effort:body.effort,fast:body.fast}));
      }
      if (path.endsWith("/account/plan")) {
        const body = z.object({ accountId: z.string().min(1), mode: z.enum(["keychain", "restart", "handoff"]) }).parse(await req.json());
        const planned = await orchaPlan(deps.link, agent.paneId, body.accountId, body.mode);
        if (planned) return json(planned);
        const roots = rootsOf(deps);
        const accounts = await readOfficeAccounts(deps.link, roots);
        return json(describeSwitch({
          agent,
          accountId: body.accountId,
          mode: body.mode,
          accounts,
          home: roots.home,
          handoff: deps.link.state().capabilities.handoff,
        }));
      }
      if (path.endsWith("/handoff")) {
        const body = z.object({ to: z.object({ kind: z.string().optional(), accountId: z.string().optional() }), mode: z.enum(["full", "summary"]) }).parse(await req.json());
        return json(await handOff(deps, agent, body.to, body.mode));
      }
      const body = z.object({
        accountId: z.string().min(1),
        mode: z.enum(["keychain", "restart", "handoff"]),
        moveAll: z.boolean().optional(),
        whenIdle: z.boolean().optional(),
      }).parse(await req.json());
      const switched = await orchaSwitch(deps.link, { paneId: agent.paneId, ...body });
      if (switched) {
        deps.activity.append({ kind: "action", text: `Account ${agent.name}: ${body.accountId} (${body.mode})${switched.queued ? " (queued)" : ""}`, paneId: agent.paneId, agentKey: agent.agentKey, workspaceId: agent.workspaceId });
        return json({ ok: true, ...switched });
      }
      if (body.mode === "handoff") return json({ ok: true, ...(await handOff(deps, agent, { accountId: body.accountId }, "summary")) });
      return json(await switchAccount({
        link: deps.link,
        agent,
        accountId: body.accountId,
        mode: body.mode,
        whenIdle: body.whenIdle,
        roots: rootsOf(deps),
        activity: deps.activity,
      }));
    }
    if (path.includes("/agents/") && path.endsWith("/conversation") && req.method === "GET") {
      const id = pane(url);
      const before = url.searchParams.get("before") ?? undefined;
      const after = url.searchParams.get("after") ?? undefined;
      const page = conversationFor(deps, id, { before, after });
      let items = page.items;
      if (page.terminal) {
        items = pageTranscript(terminalConversation(await terminalResult(deps, id), id), { before, after });
      }
      return json({ items, terminal: page.terminal });
    }
    if (path.endsWith("/question") && req.method === "GET") {
      const structured = await orchaQuestion(deps.link, pane(url)).catch(() => null);
      const data = structured?.question;
      if (data) {
        const question: StructuredQuestion = {
          text: data.text,
          options: data.options.map((option) => ({ label: option.label, key: option.key, description: option.description })),
          multiSelect: data.multi_select ?? false,
          freeText: data.free_text ?? true,
        };
        return json({ text: data.text, question });
      }
      return json({ text: await readQuestion(deps.link, pane(url)) });
    }
    if (req.method === "POST" && path.endsWith("/prompt")) {
      const body = promptBody.parse(await req.json());
      await promptAgent(deps.link, pane(url), body.text, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/keys")) {
      const body = keysBody.parse(await req.json());
      await sendKeys(deps.link, pane(url), body.keys, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/answer")) {
      const body = answerBody.parse(await req.json());
      await answerAgent(deps.link, pane(url), body, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/interrupt")) {
      await interruptAgent(deps.link, pane(url), deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/seen")) {
      markSeen(deps.link, pane(url), deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/focus") && path.includes("/agents/")) {
      await focusAgent(deps.link, pane(url), deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/rename")) {
      const body = nameBody.parse(await req.json());
      await renameAgent(deps.link, pane(url), body.name, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "PUT" && path.endsWith("/skin")) {
      const body = skinBody.parse(await req.json());
      setSkin(deps.link, pane(url), body.skin, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/agents") && path.includes("/projects/")) {
      const body = startBody.parse(await req.json());
      return json(await startAgent(deps.link, workspace(url), body, deps.activity));
    }
    if (req.method === "POST" && path.endsWith("/broadcast")) {
      const body = textBody.parse(await req.json());
      return json({ results: await broadcast(deps.link, workspace(url), body.text, deps.activity) });
    }
    if (req.method === "POST" && path.endsWith("/close") && path.includes("/agents/")) {
      await closeAgent(deps.link, pane(url), deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/close") && path.includes("/projects/")) {
      const body = z.object({ confirm: z.string() }).parse(await req.json());
      await closeProject(deps.link, workspace(url), body.confirm, deps.activity);
      return json({ ok: true });
    }
    if (req.method === "POST" && path.endsWith("/focus") && path.includes("/projects/")) {
      await focusProject(deps.link, workspace(url), deps.activity);
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}

async function handOff(
  deps: RouteDeps,
  agent: { paneId: string; kind: string },
  to: { kind?: string; accountId?: string },
  mode: "full" | "summary",
) {
  const viaOrcha = await orchaHandoff(deps.link, { paneId: agent.paneId, to, notes: mode });
  if (viaOrcha) return viaOrcha;
  const roots = rootsOf(deps);
  const accounts = await readOfficeAccounts(deps.link, roots);
  const account = to.accountId ? accounts.find((item) => item.id === to.accountId) : undefined;
  const kind = to.kind ?? account?.kind ?? agent.kind;
  return runHandoff({
    paneId: agent.paneId,
    kind,
    mode,
    orchaDir: roots.orchaDir,
    orchaBin: findOnPath("orcha") ?? "orcha",
    configDir: account?.dir,
  });
}

async function terminalResult(deps: RouteDeps, paneId: string) {
  const text = await readTerminal(deps.link, paneId);
  return { read: { text } };
}

async function readUpload(req: Request, deps: RouteDeps) {
  const form = await req.formData();
  const paneId = String(form.get("pane") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !paneId) throw new ActionError(400, "Choose a file");
  const saved = saveUpload({
    paneId,
    name: file.name,
    type: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
    home: deps.home,
  });
  deps.activity.append({ kind: "action", text: `Attachment ${file.name}`, paneId });
  return saved;
}
