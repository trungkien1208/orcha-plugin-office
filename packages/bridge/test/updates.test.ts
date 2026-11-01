import type { AppUpdate } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handleApi } from "../src/http/routes.ts";
import { OrchaError } from "../src/orcha/client.ts";
import type { Capabilities, OfficeLink } from "../src/orcha/link.ts";
import { mapPluginUpdates } from "../src/orcha/plugin-updates.ts";
import { openActivity } from "../src/state/activity.ts";
import { watchUpdates } from "../src/updates.ts";

const CAPS: Capabilities = {
  methods: ["plugin.updates", "plugin.update"],
  events: ["plugin.updates_changed"],
  features: ["plugin.updates"],
};

const row = (extra: Record<string, unknown> = {}) => ({
  id: "easy-job",
  current_version: "0.1.0",
  latest_version: "0.2.0",
  update_available: true,
  compatible: true,
  source: "trungkien1208/orcha-plugin-office",
  ref: "plugin",
  ...extra,
});

type Call = { method: string; params: unknown };

/** A link whose Orcha side is scripted per method; `caps` can be swapped to simulate a reconnect. */
function fakeLink(caps: Capabilities | null, answer: (method: string, params: unknown) => unknown = () => ({})) {
  const calls: Call[] = [];
  let pluginListener: ((plugins: unknown[]) => void) | null = null;
  const box = { caps };
  const link = {
    capabilities: () => box.caps,
    state: () => ({ agents: [], projects: [] }),
    request: async (method: string, params: unknown = {}) => {
      calls.push({ method, params });
      return answer(method, params);
    },
    onPluginUpdates(listener: (plugins: unknown[]) => void) {
      pluginListener = listener;
      return () => {
        pluginListener = null;
      };
    },
    updateLocal() {},
    reemit() {},
    stop() {},
    dropSocket() {},
  } as unknown as OfficeLink;
  return { link, calls, box, push: (plugins: unknown[]) => pluginListener?.(plugins) };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const activity = () => openActivity(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-upd-")), "activity.jsonl"));
const post = (route: string) => new Request(`http://127.0.0.1:4317${route}`, { method: "POST" });

describe("Easy Job updates through Orcha", () => {
  test("an Orcha without the capability gets no update UI and no calls", async () => {
    const { link, calls } = fakeLink({ methods: ["agent.models"], features: [] });
    const changes: AppUpdate[] = [];
    const watch = watchUpdates(link, (update) => changes.push(update), "0.1.0");
    watch.check();
    await tick();
    expect(watch.current()).toEqual({ supported: false, running: "0.1.0", available: false, compatible: true });
    expect(calls).toEqual([]);
    await expect(watch.apply()).rejects.toThrow("can't update plugins");
    const response = await handleApi(post("/api/update/apply"), { link, activity: activity(), updates: watch });
    expect(response.status).toBe(409);
    expect(calls).toEqual([]);
  });

  test("an available update is read from Orcha's cache, once per link session", async () => {
    const { link, calls, box } = fakeLink(CAPS, () => ({ type: "plugin_updates", plugins: [{ id: "other" }, row()] }));
    const changes: AppUpdate[] = [];
    const watch = watchUpdates(link, (update) => changes.push(update), "0.1.0");
    watch.check();
    watch.check();
    await tick();
    expect(calls).toEqual([{ method: "plugin.updates", params: {} }]);
    expect(watch.current()).toEqual({ supported: true, running: "0.1.0", installed: "0.1.0", latest: "0.2.0", available: true, compatible: true });
    expect(changes).toHaveLength(1);
    box.caps = { ...CAPS };
    watch.check();
    await tick();
    expect(calls).toHaveLength(2);
    expect(changes).toHaveLength(1);
  });

  test("Check now asks GitHub through Orcha, and only then", async () => {
    const { link, calls } = fakeLink(CAPS, () => ({ plugins: [row({ update_available: false, latest_version: "0.1.0" })] }));
    const watch = watchUpdates(link, () => {}, "0.1.0");
    const response = await handleApi(post("/api/update/check"), { link, activity: activity(), updates: watch });
    expect(response.status).toBe(200);
    expect(calls).toEqual([{ method: "plugin.updates", params: { refresh: true } }]);
    expect(((await response.json()) as AppUpdate).available).toBe(false);
  });

  test("an incompatible update names the Herdr version it needs", () => {
    const update = mapPluginUpdates([row({ compatible: false, needs_herdr_version: "0.9.9" })], "0.1.0");
    expect(update).toMatchObject({ available: true, compatible: false, needsHerdrVersion: "0.9.9" });
    expect(mapPluginUpdates([], "0.1.0")).toMatchObject({ supported: true, available: false });
    expect(mapPluginUpdates("nope", "0.1.0").available).toBe(false);
  });

  test("plugin.updates_changed events replace the cached answer", async () => {
    const { link, push } = fakeLink(CAPS, () => ({ plugins: [] }));
    const changes: AppUpdate[] = [];
    const watch = watchUpdates(link, (update) => changes.push(update), "0.1.0");
    watch.check();
    await tick();
    push([row({ latest_version: "0.3.0" })]);
    expect(watch.current()).toMatchObject({ available: true, latest: "0.3.0" });
    expect(changes.at(-1)?.latest).toBe("0.3.0");
  });

  test("a clean update returns the new version", async () => {
    const { link, calls } = fakeLink(CAPS, () => ({ type: "plugin_updated", id: "easy-job", version: "0.2.0" }));
    const watch = watchUpdates(link, () => {}, "0.1.0");
    const response = await handleApi(post("/api/update/apply"), { link, activity: activity(), updates: watch });
    expect(await response.json()).toEqual({ outcome: "updated", version: "0.2.0" });
    expect(calls).toEqual([{ method: "plugin.update", params: { id: "easy-job" } }]);
  });

  test("a failed build returns its log tail for the copy box", async () => {
    const log = "fetch.sh: line 3\ncurl: (22) The requested URL returned error: 404\nEasy Job 0.2.0: checksum mismatch";
    const { link } = fakeLink(CAPS, () => {
      throw new OrchaError("plugin_update_failed", log);
    });
    const watch = watchUpdates(link, () => {}, "0.1.0");
    const response = await handleApi(post("/api/update/apply"), { link, activity: activity(), updates: watch });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The update failed while building Easy Job", code: "plugin_update_failed", log });
  });

  test("a refusal for an old Herdr is a 409 without a log", async () => {
    const { link } = fakeLink(CAPS, () => {
      throw new OrchaError("plugin_requires_newer_herdr", "needs herdr 0.9.9");
    });
    const response = await handleApi(post("/api/update/apply"), { link, activity: activity(), updates: watchUpdates(link, () => {}) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "plugin_requires_newer_herdr" });
  });

  test("a connection that drops during the update means Orcha is restarting us", async () => {
    for (const error of [new OrchaError("closed", "Orcha connection closed"), Object.assign(new Error("reset"), { code: "ECONNRESET" })]) {
      const { link } = fakeLink(CAPS, () => {
        throw error;
      });
      expect(await watchUpdates(link, () => {}).apply()).toEqual({ outcome: "restarting" });
    }
  });
});
