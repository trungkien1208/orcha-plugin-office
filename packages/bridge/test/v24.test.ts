import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { answerAgent, readTerminal, startAgent } from "../src/actions.ts";
import type { Capabilities, OfficeLink } from "../src/orcha/link.ts";
import { mapAccounts, orchaConfigure, orchaModels, orchaPlan, orchaSwitch } from "../src/orcha/v24.ts";
import { openActivity } from "../src/state/activity.ts";

type Call = { method: string; params: Record<string, unknown> };

function fakeLink(caps: Capabilities | null, answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const link = {
    capabilities: () => caps,
    state: () => ({
      agents: [{ paneId: "w1:p1", name: "Headset", kind: "claude", status: "blocked", agentKey: "k", workspaceId: "w1" }],
      projects: [{ workspaceId: "w1", label: "alpha", cwd: "/tmp/alpha" }],
    }),
    request: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      return answers[method] ?? {};
    },
    updateLocal() {},
    reemit() {},
    stop() {},
    dropSocket() {},
  } as unknown as OfficeLink;
  return { link, calls };
}

const activity = () => openActivity(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-v24-")), "activity.jsonl"));

describe("protocol 24 adapter", () => {
  test("maps accounts without credentials and skips malformed rows", () => {
    const accounts = mapAccounts([
      { id: "claude-work", kind: "claude", label: "Work", email: "a@b.c", signed_in: true, is_default: true, pane_ids: ["w1:p1"], fuel: [{ key: "session", label: "5H", left_percent: 40, reset_at: 100 }] },
      { id: "x", kind: "gemini", label: "" },
      { nope: true },
      null,
    ]);
    expect(accounts).toEqual([
      { id: "claude-work", label: "Work", kind: "claude", email: "a@b.c", plan: undefined, signedIn: true, active: true, fuel: [{ key: "session", label: "5H", left: 40, resetAt: 100_000 }], panes: ["w1:p1"] },
      { id: "x", label: "x", kind: "other", email: undefined, plan: undefined, signedIn: false, active: false, fuel: [], panes: [] },
    ]);
  });

  test("maps the model catalog, fast efforts and variants", async () => {
    const { link } = fakeLink({ methods: ["agent.models"] }, {
      "agent.models": { source: "cli", models: [{ id: "opus", name: "Opus", efforts: ["low", "high"], default_effort: "high", fast_available: true, fast_efforts: ["low"], variants: [{ id: "opus[1m]", name: "1M" }] }] },
    });
    const catalog = await orchaModels(link, "claude");
    expect(catalog?.source).toBe("Orcha · cli");
    expect(catalog?.models[0]).toEqual({ id: "opus", name: "Opus", description: undefined, efforts: ["low", "high"], defaultEffort: "high", fast: true, fastEfforts: ["low"], variants: [{ model: "opus[1m]", name: "1M", effort: undefined, fast: false }] });
  });

  test("returns null without the method so callers keep the old path", async () => {
    const { link, calls } = fakeLink({ methods: [] });
    expect(await orchaModels(link, "claude")).toBeNull();
    expect(await orchaConfigure(link, "w1:p1", { model: "opus" })).toBeNull();
    expect(await orchaPlan(link, "w1:p1", "a", "restart")).toBeNull();
    expect(calls).toEqual([]);
    expect(await orchaModels(fakeLink(null).link, "claude")).toBeNull();
  });

  test("switch modes use Orcha's names and report a queued move", async () => {
    const { link, calls } = fakeLink({ methods: ["accounts.switch"] }, { "accounts.switch": { outcome: "queued" } });
    expect(await orchaSwitch(link, { paneId: "w1:p1", accountId: "work", mode: "keychain", whenIdle: true })).toEqual({ paneId: "w1:p1", queued: true });
    expect(calls[0]?.params).toEqual({ pane_id: "w1:p1", account_id: "work", mode: "keep", move_all: false, when_idle: true });
  });
});

describe("protocol 24 actions", () => {
  test("answers by option key through agent.answer", async () => {
    const { link, calls } = fakeLink({ methods: ["agent.answer"] });
    await answerAgent(link, "w1:p1", { option: "2" }, activity());
    expect(calls).toEqual([{ method: "agent.answer", params: { pane_id: "w1:p1", option: "2" } }]);
  });

  test("an older Orcha gets typed text and refuses option answers", async () => {
    const { link, calls } = fakeLink({ methods: [] });
    await answerAgent(link, "w1:p1", "yes", activity());
    expect(calls[0]?.method).toBe("pane.send_input");
    await expect(answerAgent(link, "w1:p1", { option: "1" }, activity())).rejects.toThrow("typed answers");
  });

  test("starts an agent in one call when Orcha opens its own tab", async () => {
    const { link, calls } = fakeLink({ features: ["agent.start.workspace"], methods: [] }, { "agent.start": { agent: { pane_id: "w1:p9" } } });
    const result = await startAgent(link, "w1", { kind: "claude", name: "Nova", prompt: "Fix it", model: "opus" }, activity());
    expect(result).toEqual({ paneId: "w1:p9" });
    expect(calls.map((call) => call.method)).toEqual(["agent.start"]);
    expect(calls[0]?.params).toMatchObject({ workspace_id: "w1", kind: "claude", name: "Nova", model: "opus", prompt: "Fix it" });
  });

  test("reads terminal history without scroll input when scrollback exists", async () => {
    const withScrollback = fakeLink({ features: ["read.source.scrollback"] });
    await readTerminal(withScrollback.link, "w1:p1");
    expect(withScrollback.calls[0]?.params.source).toBe("scrollback");
    const older = fakeLink(null);
    await readTerminal(older.link, "w1:p1");
    expect(older.calls[0]?.params.source).toBe("visible");
  });
});

describe("Codex launch", () => {
  test("Codex starts without the shared daemon so Orcha's session hook reports to its own pane", async () => {
    const { link, calls } = fakeLink({ features: ["agent.start.workspace"], methods: ["agent.configure"] }, { "agent.start": { agent: { pane_id: "w1:p9" } } });
    await startAgent(link, "w1", { kind: "codex" }, activity());
    expect(calls[0]?.params.args).toEqual(["--no-daemon"]);
  });
});
