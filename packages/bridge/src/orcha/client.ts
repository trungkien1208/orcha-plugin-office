import type { Conn } from "./transport.ts";

export class OrchaError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OrchaError";
  }
}

type ErrorLine = { id?: string; error?: { code?: string; message?: string }; result?: unknown };

export type OrchaClient = {
  request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
};

let nextId = 0;

export function createClient(connect: () => Promise<Conn>, timeoutMs = 10_000): OrchaClient {
  return {
    async request(method, params = {}, timeout = timeoutMs) {
      const conn = await connect();
      const id = `oo-${++nextId}`;
      conn.send({ id, method, params });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const line = await Promise.race([
          conn.next(),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), timeout);
          }),
        ]);
        if (line == null) {
          throw new OrchaError("timeout", `Orcha did not answer ${method}`);
        }
        const message = line as ErrorLine;
        if (message.id && message.id !== id) {
          throw new OrchaError("protocol", `unexpected id ${message.id} for ${method}`);
        }
        if (message.error) {
          throw new OrchaError(message.error.code ?? "error", message.error.message ?? method);
        }
        return message.result;
      } finally {
        if (timer) clearTimeout(timer);
        conn.close();
      }
    },
  };
}
