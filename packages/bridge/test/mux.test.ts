import { describe, expect, test } from "bun:test";
import { syncSupported } from "../src/orcha/link.ts";
import { openMux } from "../src/orcha/mux.ts";
import type { Conn } from "../src/orcha/transport.ts";

/** A connection whose server side is driven by the test. */
function fakeConn() {
  const sent: Array<{ id: string; method: string }> = [];
  const queue: unknown[] = [];
  let waiter: ((value: unknown) => void) | null = null;
  let closed = false;
  const conn: Conn = {
    send: (value) => sent.push(value as { id: string; method: string }),
    next: () => (queue.length ? Promise.resolve(queue.shift()) : closed ? Promise.resolve(null) : new Promise((resolve) => { waiter = resolve; })),
    close: () => { closed = true; waiter?.(null); },
  };
  const reply = (line: unknown) => { if (waiter) { const w = waiter; waiter = null; w(line); } else queue.push(line); };
  return { conn, sent, reply };
}

describe("multiplexed Orcha connection", () => {
  test("answers by id in completion order and routes subscription events and errors", async () => {
    const { conn, sent, reply } = fakeConn();
    reply({ id: "mux", result: { type: "ok" } });
    const mux = await openMux(conn);
    const events: unknown[] = [];
    const subscribed = mux.subscribe([{ type: "session.changed" }], (line) => events.push(line));
    const subId = sent.at(-1)?.id ?? "";
    reply({ id: subId, result: { type: "subscription_started", warnings: ["pane w9:p9 not found; skipped"] } });
    expect(await subscribed).toEqual(["pane w9:p9 not found; skipped"]);
    const first = mux.request("agent.list");
    const second = mux.request("session.snapshot");
    const [firstId, secondId] = sent.slice(-2).map((item) => item.id);
    reply({ id: secondId, result: { type: "session_snapshot" } });
    reply({ id: subId, event: "session_changed", data: { version: 2 } });
    reply({ id: firstId, result: { type: "agent_list" } });
    reply({ id: subId, error: { code: "events_lost", message: "lost" } });
    expect(await second).toEqual({ type: "session_snapshot" });
    expect(await first).toEqual({ type: "agent_list" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toHaveLength(2);
    const pending = mux.request("slow");
    mux.close();
    await expect(pending).rejects.toThrow("closed");
    await mux.closed;
  });

  test("a server without multiplex is refused, and sync needs every feature", async () => {
    const { conn, reply } = fakeConn();
    reply({ id: "mux", error: { code: "invalid_request", message: "unknown method" } });
    await expect(openMux(conn)).rejects.toThrow("unknown method");
    const full = { methods: ["server.multiplex"], events: ["session.changed"], features: ["events.subscribe.agent_status_all_panes", "session.snapshot.since"] };
    expect(syncSupported(full)).toBe(true);
    expect(syncSupported({ ...full, features: ["session.snapshot.since"] })).toBe(false);
    expect(syncSupported(null)).toBe(false);
  });
});
