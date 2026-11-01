import { emptyOffice, type OfficeState } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer } from "../src/http/server.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { openActivity } from "../src/state/activity.ts";

const HTML_CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; frame-ancestors 'none'";

function rig(state: OfficeState) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-gate-"));
  const link: OfficeLink = {
    state: () => state,
    request: async () => {
      throw new Error("no orcha");
    },
    reemit() {},
    updateLocal() {},
    dropSocket() {},
    stop() {},
  };
  const server = startServer({
    link,
    activity: openActivity(path.join(home, "activity.jsonl")),
    distDir: home,
    port: 35000 + (process.pid % 1000),
    open: false,
    token: "gate-token",
  });
  return { server, stop: () => server.stop() };
}

describe("gate", () => {
  test("the app and /landing load without a token, and HTML carries the security headers", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-static-"));
    fs.writeFileSync(path.join(home, "index.html"), "<!doctype html><title>Easy Job</title>");
    fs.writeFileSync(path.join(home, "landing.html"), "<!doctype html><title>Landing</title>");
    fs.mkdirSync(path.join(home, "landing"));
    fs.writeFileSync(path.join(home, "landing", "hero.png"), "png");
    const link: OfficeLink = {
      state: () => emptyOffice("/tmp/sock"),
      request: async () => {
        throw new Error("no orcha");
      },
      reemit() {},
      updateLocal() {},
      dropSocket() {},
      stop() {},
    };
    const server = startServer({
      link,
      activity: openActivity(path.join(home, "activity.jsonl")),
      distDir: home,
      port: 36000 + (process.pid % 1000),
      open: false,
      token: "gate-token",
    });
    try {
      const app = await fetch(`http://127.0.0.1:${server.port}/`);
      const landing = await fetch(`http://127.0.0.1:${server.port}/landing`);
      const hero = await fetch(`http://127.0.0.1:${server.port}/landing/hero.png`);
      const api = await fetch(`http://127.0.0.1:${server.port}/api/state`);
      expect(app.status).toBe(200);
      expect(await app.text()).toContain("Easy Job");
      expect(landing.status).toBe(200);
      expect(await landing.text()).toContain("Landing");
      expect(hero.status).toBe(200);
      expect(await hero.text()).toBe("png");
      expect(api.status).toBe(401);
      for (const response of [app, landing]) {
        expect(response.headers.get("content-security-policy")).toBe(HTML_CSP);
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      }
      expect(hero.headers.get("content-security-policy")).toBeNull();
    } finally {
      server.stop();
    }
  });

  test("health is public and carries no names, paths, or counts", async () => {
    const state = emptyOffice("/tmp/secret.sock");
    state.orcha.connected = true;
    state.orcha.protocolWarning = "Orcha protocol 21 is untested; some actions may fail";
    state.projects = [{ workspaceId: "w1", number: 1, label: "Secret", projectColor: "#000", terminalCount: 1 }];
    const { server, stop } = rig(state);
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/api/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        bridge: true,
        orcha: true,
        protocolWarning: "Orcha protocol 21 is untested; some actions may fail",
      });
      const foreign = await fetch(`http://127.0.0.1:${server.port}/api/health`, { headers: { host: "evil.test" } });
      expect(foreign.status).toBe(403);
    } finally {
      stop();
    }
  });

  test("a bad or missing HTTP token is 401 bad_token, and a bad socket closes 4401", async () => {
    const { server, stop } = rig(emptyOffice("/tmp/sock"));
    try {
      const missing = await fetch(`http://127.0.0.1:${server.port}/api/state`);
      expect(missing.status).toBe(401);
      expect(await missing.json()).toEqual({ error: "bad_token" });
      const wrong = await fetch(`http://127.0.0.1:${server.port}/api/state`, { headers: { authorization: "Bearer nope" } });
      expect(wrong.status).toBe(401);
      expect(await wrong.json()).toEqual({ error: "bad_token" });
      const closed = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, ["easy-job.nope"]);
        ws.addEventListener("close", (event) => resolve({ code: event.code, reason: event.reason }));
        ws.addEventListener("error", () => reject(new Error("websocket failed before close")));
      });
      expect(closed).toEqual({ code: 4401, reason: "bad_token" });
    } finally {
      stop();
    }
  });
});
