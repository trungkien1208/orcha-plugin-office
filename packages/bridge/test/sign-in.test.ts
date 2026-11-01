import { demoSnapshot, startFakeOrcha } from "./fake-orcha.ts";
import type { OfficeState, SessionSnapshot } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AccountRoots } from "../src/accounts.ts";
import { startServer } from "../src/http/server.ts";
import { startLink } from "../src/orcha/link.ts";
import { connect } from "../src/orcha/transport.ts";
import { openActivity } from "../src/state/activity.ts";
import { loadLocal } from "../src/state/local.ts";

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "fixtures/snapshot-live.json"), "utf8")) as {
  result: { snapshot: SessionSnapshot };
};

describe("sign in", () => {
  test("opens an unfocused tab and runs claude auth login in the account folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-login-"));
    const roots: AccountRoots = { orchaDir: path.join(dir, "orcha"), limitsDir: path.join(dir, "limits"), home: path.join(dir, "home") };
    const work = path.join(roots.home, "work");
    fs.mkdirSync(roots.orchaDir, { recursive: true });
    fs.writeFileSync(path.join(roots.orchaDir, "config.json"), JSON.stringify({
      accounts: [{ id: "claude-work", kind: "claude", label: "Work", dir: work }],
    }));
    const fake = await startFakeOrcha({ socketPath: path.join(dir, "herdr.sock"), snapshot: demoSnapshot(fixture.result.snapshot) });
    const link = startLink({
      connect: () => connect(fake.socketPath),
      socketPath: fake.socketPath,
      local: loadLocal(path.join(dir, "state.json")),
      activity: openActivity(path.join(dir, "activity.jsonl")),
      debounceMs: 0,
      backoffStartMs: 0,
    });
    const server = startServer({
      link,
      activity: openActivity(path.join(dir, "activity-2.jsonl")),
      distDir: dir,
      port: 41000 + (process.pid % 1000),
      open: false,
      accountRoots: roots,
      accountPollMs: 60_000,
    });
    const headers = { authorization: `Bearer ${server.token}`, "content-type": "application/json" };
    try {
      let state: OfficeState | null = null;
      for (let i = 0; i < 40 && !state?.orcha.connected; i += 1) {
        state = (await (await fetch(`http://127.0.0.1:${server.port}/api/state`, { headers })).json()) as OfficeState;
        await Bun.sleep(25);
      }
      const response = await fetch(`http://127.0.0.1:${server.port}/api/accounts/claude-work/login`, { method: "POST", headers });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { paneId: string };
      expect(body.paneId.length).toBeGreaterThan(0);
      const created = fake.calls.find((call) => call.method === "tab.create");
      expect(created?.params).toMatchObject({ focus: false });
      const typed = fake.calls.find((call) => call.method === "pane.send_input");
      expect(typed?.params).toMatchObject({ text: `CLAUDE_CONFIG_DIR=${work} claude auth login`, keys: ["enter"] });
    } finally {
      server.stop();
      link.stop();
      await fake.close();
    }
  });
});
