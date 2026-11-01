import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { OrchaError, createClient } from "../src/orcha/client.ts";
import { connect, resolveSocketPath } from "../src/orcha/transport.ts";

describe("socket path", () => {
  const exists = (file: string) => file.endsWith("present.sock");

  test("prefers ORCHA_OFFICE_SOCKET, then session, then HERDR_SOCKET_PATH, then the Orcha socket", () => {
    expect(resolveSocketPath({ socket: "/tmp/explicit.sock" }, {}, exists)).toBe("/tmp/explicit.sock");
    expect(resolveSocketPath({}, { ORCHA_OFFICE_SOCKET: "/tmp/env.sock", HOME: "/home/me" }, exists)).toBe(
      "/tmp/env.sock",
    );
    expect(resolveSocketPath({ session: "demo" }, { HOME: "/home/me" }, () => false)).toBe(
      "/home/me/.config/herdr/herdr.sock",
    );
    expect(
      resolveSocketPath({ session: "demo" }, { HOME: "/home/me" }, (file) => file.endsWith("/sessions/demo/herdr.sock")),
    ).toBe("/home/me/.config/orcha/sessions/demo/herdr.sock");
    expect(resolveSocketPath({}, { HERDR_SOCKET_PATH: "/tmp/herdr.sock", HOME: "/home/me" }, exists)).toBe(
      "/tmp/herdr.sock",
    );
    expect(
      resolveSocketPath({}, { HOME: "/home/me" }, (file) => file === "/home/me/.config/orcha/herdr.sock"),
    ).toBe("/home/me/.config/orcha/herdr.sock");
    expect(resolveSocketPath({}, { HOME: "/home/me" }, () => false)).toBe("/home/me/.config/herdr/herdr.sock");
  });
});

describe("transport and client", () => {
  test("parses NDJSON, skips a bad line, and returns Orcha errors", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "orcha-sock-")), "herdr.sock");
    const server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (chunk) => {
        buf += chunk.toString();
        if (!buf.includes("\n")) return;
        const request = JSON.parse(buf.slice(0, buf.indexOf("\n"))) as { id: string; method: string };
        socket.write("not-json\n");
        if (request.method === "session.snapshot") {
          socket.write(`${JSON.stringify({ id: request.id, result: { type: "session_snapshot", snapshot: { ok: true } } })}\n`);
        } else {
          socket.write(
            `${JSON.stringify({ id: request.id, error: { code: "pane_not_found", message: "missing" } })}\n`,
          );
        }
        socket.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(file, resolve));
    try {
      const conn = await connect(file);
      conn.send({ id: "1", method: "ping" });
      expect(await conn.next()).toEqual({ id: "1", error: { code: "pane_not_found", message: "missing" } });
      const client = createClient(() => connect(file));
      const result = (await client.request("session.snapshot", {})) as { snapshot: { ok: boolean } };
      expect(result.snapshot.ok).toBe(true);
      await expect(client.request("agent.get", { target: "nope" })).rejects.toBeInstanceOf(OrchaError);
    } finally {
      server.close();
    }
  });
});
