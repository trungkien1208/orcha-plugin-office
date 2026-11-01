import { demoSnapshot, startFakeOrcha } from "./fake-orcha.ts";
import type { ConversationItem, OfficeState, SessionSnapshot } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer } from "../src/http/server.ts";
import { startLink } from "../src/orcha/link.ts";
import { connect } from "../src/orcha/transport.ts";
import { mergeThread, ownerPrompt } from "../src/team.ts";
import { openActivity } from "../src/state/activity.ts";
import { loadLocal } from "../src/state/local.ts";

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "fixtures/snapshot-live.json"), "utf8")) as {
  result: { snapshot: SessionSnapshot };
};

function item(id: string, at: number, role: ConversationItem["role"], extra: Partial<ConversationItem> = {}): ConversationItem {
  return { id, at, role, ...extra };
}

describe("team thread", () => {
  test("messages merge by time, and a prompt tool marks who sent it", () => {
    expect(ownerPrompt("look", ["Ada"])).toBe("look");
    expect(ownerPrompt("look", ["Ada", "Bea"])).toBe("From the Owner, also sent to: Ada, Bea\n\nlook");
    const items = mergeThread([
      {
        paneId: "p1",
        name: "Ada",
        items: [
          item("t1", 2, "tool", { tool: { name: "Bash", summary: "herdr agent prompt Bea" } }),
          item("a1", 4, "agent", { text: "done" }),
        ],
      },
      {
        paneId: "p2",
        name: "Bea",
        items: [item("u1", 3, "user", { text: "please review" })],
      },
    ]);
    expect(items.map((entry) => entry.id)).toEqual(["t1", "u1", "a1"]);
    expect(items[1]?.from).toBe("p1");
    expect(items[2]?.from).toBeUndefined();
  });

  test("a prompt to two Agents is prefixed and sent through the fake Orcha", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-team-"));
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
      port: 42000 + (process.pid % 1000),
      open: false,
      accountPollMs: 60_000,
    });
    const headers = { authorization: `Bearer ${server.token}`, "content-type": "application/json" };
    try {
      let state: OfficeState | null = null;
      for (let i = 0; i < 40 && !state?.orcha.connected; i += 1) {
        state = (await (await fetch(`http://127.0.0.1:${server.port}/api/state`, { headers })).json()) as OfficeState;
        await Bun.sleep(25);
      }
      const idle = (state?.agents ?? []).filter((agent) => agent.status === "idle").slice(0, 2);
      if (idle.length < 2) throw new Error("need two idle agents");
      const project = idle[0]?.workspaceId;
      const same = idle.filter((agent) => agent.workspaceId === project).slice(0, 2);
      const targets = same.length === 2 ? same : idle;
      const response = await fetch(`http://127.0.0.1:${server.port}/api/projects/${encodeURIComponent(targets[0]?.workspaceId ?? "")}/prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: targets.map((agent) => agent.paneId), text: "check the API" }),
      });
      expect(response.status).toBe(200);
      const prompts = fake.calls.filter((call) => call.method === "agent.prompt");
      expect(prompts.length).toBeGreaterThanOrEqual(2);
      const first = prompts[0];
      const text = first ? String((first.params as { text?: string }).text ?? "") : "";
      expect(text.startsWith("From the Owner, also sent to:")).toBe(true);
      expect(text).toContain("check the API");
    } finally {
      server.stop();
      link.stop();
      await fake.close();
    }
  });
});
