import type { AppUpdate } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import { applied, failed, hello, IDLE, noticeFor, restore, RESTART_WAIT_MS, SLOW_MS, STALE_MS, startUpdate, tick } from "./update-flow.ts";

const offer: AppUpdate = { supported: true, running: "0.1.0", installed: "0.1.0", latest: "0.2.0", available: true, compatible: true };

describe("update notice", () => {
  test("an Orcha without the capability shows nothing", () => {
    expect(noticeFor({ supported: false, running: "0.1.0", available: false, compatible: true }, IDLE, null, 0)).toBeNull();
    expect(noticeFor({ ...offer, supported: false }, IDLE, null, 0)).toBeNull();
    expect(noticeFor(null, IDLE, null, 0)).toBeNull();
  });

  test("an available update is offered until that version is dismissed", () => {
    expect(noticeFor(offer, IDLE, null, 0)).toEqual({ kind: "offer", version: "0.2.0" });
    expect(noticeFor(offer, IDLE, "0.2.0", 0)).toBeNull();
    expect(noticeFor({ ...offer, latest: "0.3.0" }, IDLE, "0.2.0", 0)).toEqual({ kind: "offer", version: "0.3.0" });
    expect(noticeFor({ ...offer, running: "0.2.0" }, IDLE, null, 0)).toBeNull();
    expect(noticeFor({ ...offer, available: false }, IDLE, null, 0)).toBeNull();
  });

  test("an incompatible update asks for a newer Orcha and cannot start", () => {
    const update = { ...offer, compatible: false, needsHerdrVersion: "0.9.9" };
    expect(noticeFor(update, IDLE, null, 0)).toEqual({ kind: "incompatible", version: "0.2.0" });
    expect(startUpdate(update, 0)).toEqual(IDLE);
  });
});

describe("update flow", () => {
  test("a clean update waits for the restarted server to report the new version", () => {
    let flow = startUpdate(offer, 1000);
    expect(noticeFor(offer, flow, null, 1000)).toEqual({ kind: "updating", version: "0.2.0", slow: false });
    flow = applied(flow, { outcome: "updated", version: "0.2.0" }, 2000);
    expect(flow.phase).toBe("updating");
    // The old bridge says hello again (the socket blipped): still updating.
    flow = hello(flow, "0.1.0", false);
    expect(flow.phase).toBe("updating");
    flow = hello(flow, "0.2.0", true);
    expect(flow).toEqual({ phase: "done", version: "0.2.0" });
  });

  test("a disconnect during the call keeps updating, then the reconnect confirms", () => {
    let flow = applied(startUpdate(offer, 0), { outcome: "restarting" }, 10);
    expect(flow.phase).toBe("updating");
    expect(tick(flow, 10 + RESTART_WAIT_MS * 3, true).phase).toBe("updating");
    expect(noticeFor(offer, flow, null, SLOW_MS + 1)).toMatchObject({ kind: "updating", slow: true });
    flow = hello(flow, "0.2.0", true);
    expect(flow).toEqual({ phase: "done", version: "0.2.0" });
  });

  test("a restart on the old version is reported, not taken for success", () => {
    const flow = hello(startUpdate(offer, 0), "0.1.0", true);
    expect(flow).toMatchObject({ phase: "failed", target: "0.2.0" });
  });

  test("a failed build keeps its log for the copy box", () => {
    const log = "curl: (22) 404\nbuild command exited with status 22";
    const flow = failed(startUpdate(offer, 0), { error: "The update failed while building Easy Job", code: "plugin_update_failed", log });
    expect(noticeFor(offer, flow, "0.2.0", 0)).toEqual({ kind: "failed", version: "0.2.0", error: "The update failed while building Easy Job", log });
  });

  test("an answer without a restart says Easy Job needs one", () => {
    const flow = applied(startUpdate(offer, 0), { outcome: "updated", version: "0.2.0" }, 100);
    expect(tick(flow, 100 + RESTART_WAIT_MS - 1, true).phase).toBe("updating");
    expect(tick(flow, 100 + RESTART_WAIT_MS + 1, false).phase).toBe("updating");
    expect(tick(flow, 100 + RESTART_WAIT_MS + 1, true)).toEqual({ phase: "installed", version: "0.2.0" });
  });

  test("a saved flow survives a reload while fresh, and junk is ignored", () => {
    const flow = startUpdate(offer, 1000);
    expect(restore(JSON.stringify(flow), 2000)).toEqual(flow);
    expect(restore(JSON.stringify(flow), 1000 + STALE_MS + 1)).toEqual(IDLE);
    expect(restore(JSON.stringify({ phase: "done", version: "0.2.0" }), 0)).toEqual({ phase: "done", version: "0.2.0" });
    expect(restore("{nope", 0)).toEqual(IDLE);
    expect(restore(null, 0)).toEqual(IDLE);
  });
});
