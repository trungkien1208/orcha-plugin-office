import type { OrchaLine } from "@easy-job/shared";
import { OrchaError } from "./client.ts";
import type { Conn } from "./transport.ts";

/**
 * One long-lived Orcha connection (protocol 23 `server.multiplex`): requests are answered by id in completion order,
 * and subscriptions share the socket, their event lines carrying the subscribing request's id.
 */
export type Mux = {
  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
  /** Starts a subscription; resolves with the ack's warnings. Events go to `onEvent` until the connection closes. */
  subscribe(subscriptions: unknown[], onEvent: (line: OrchaLine) => void): Promise<string[]>;
  /** Resolves when the connection closes (Orcha stopped, socket dropped, or `close()`). */
  closed: Promise<void>;
  close(): void;
};

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer?: ReturnType<typeof setTimeout> };

let nextId = 0;

export async function openMux(conn: Conn, timeoutMs = 10_000): Promise<Mux> {
  conn.send({ id: "mux", method: "server.multiplex", params: {} });
  const ack = (await conn.next()) as OrchaLine | null;
  if (!ack || ack.error || ack.result?.type !== "ok") {
    conn.close();
    throw new OrchaError(ack?.error?.code ?? "multiplex_rejected", ack?.error?.message ?? "server.multiplex was not accepted");
  }
  const pending = new Map<string, Pending>();
  const listeners = new Map<string, (line: OrchaLine) => void>();
  let markClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });

  void (async () => {
    for (;;) {
      const line = (await conn.next()) as OrchaLine | null;
      if (line == null) break;
      const id = line.id ?? "";
      // Events, and errors on a running subscription (such as `events_lost`), go to that subscription.
      if (line.event || (line.error && !pending.has(id) && listeners.has(id))) {
        listeners.get(id)?.(line);
        continue;
      }
      const waiter = pending.get(id);
      if (!waiter) continue;
      pending.delete(id);
      if (waiter.timer) clearTimeout(waiter.timer);
      if (line.error) waiter.reject(new OrchaError(line.error.code ?? "error", line.error.message ?? id));
      else waiter.resolve(line.result);
    }
    for (const waiter of pending.values()) {
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.reject(new OrchaError("closed", "Orcha connection closed"));
    }
    pending.clear();
    listeners.clear();
    markClosed();
  })();

  function send(method: string, params: unknown, timeout: number | null): { id: string; result: Promise<unknown> } {
    const id = `ej-${++nextId}`;
    const result = new Promise<unknown>((resolve, reject) => {
      const entry: Pending = { resolve, reject };
      if (timeout) {
        entry.timer = setTimeout(() => {
          pending.delete(id);
          reject(new OrchaError("timeout", `Orcha did not answer ${method}`));
        }, timeout);
      }
      pending.set(id, entry);
    });
    conn.send({ id, method, params });
    return { id, result };
  }

  return {
    request(method, params = {}, timeout = timeoutMs) {
      return send(method, params, timeout).result;
    },
    async subscribe(subscriptions, onEvent) {
      const { id, result } = send("events.subscribe", { subscriptions }, timeoutMs);
      listeners.set(id, onEvent);
      const ack = (await result) as { type?: string; warnings?: string[] };
      if (ack?.type !== "subscription_started") {
        listeners.delete(id);
        throw new OrchaError("subscription_rejected", "events.subscribe was not accepted");
      }
      return ack.warnings ?? [];
    },
    closed,
    close() {
      conn.close();
    },
  };
}
