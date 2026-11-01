import { emptyOffice, type AccountInfo, type Agent, type ServerMessage } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { accountsAffectAgents, configDirFromPs, listAccounts, readOfficeAccounts, stampAccounts, type AccountRoots } from "../src/accounts.ts";
import { startServer } from "../src/http/server.ts";
import type { OfficeLink } from "../src/orcha/link.ts";
import { openActivity } from "../src/state/activity.ts";

function roots(dir: string): AccountRoots {
  return { orchaDir: path.join(dir, "orcha"), limitsDir: path.join(dir, "limits"), home: path.join(dir, "home") };
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

describe("account files", () => {
  test("profiles contribute email and plan, never a token, and fuel marks the pane", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-accounts-"));
    const base = roots(dir);
    const work = path.join(base.home, "work");
    write(path.join(base.orchaDir, "config.json"), JSON.stringify({
      accounts: [{ id: "claude-work", kind: "claude", label: "Work", dir: "~/work" }],
      hidden_accounts: ["cursor"],
    }));
    write(path.join(base.orchaDir, "claude-active"), "claude-work\n");
    write(path.join(base.orchaDir, "claude-accounts", "claude-work.json"), JSON.stringify({
      oauthAccount: { emailAddress: "ada@example.com", subscriptionType: "max", accessToken: "sekret-token", refreshToken: "also-sekret" },
    }));
    write(path.join(base.limitsDir, "claude-work.json"), JSON.stringify({ session: [95, 1_700_000_000] }));
    write(path.join(base.home, ".codex", "auth.json"), JSON.stringify({ tokens: { id_token: "codex-token" } }));
    const accounts = listAccounts({
      roots: base,
      installed: { claude: true, codex: true, cursor: true },
      panes: [
        { paneId: "p1", kind: "claude", configDir: work },
        { paneId: "p2", kind: "claude" },
        { paneId: "p3", kind: "codex" },
      ],
    });
    const dumped = JSON.stringify(accounts);
    expect(dumped).not.toContain("sekret");
    expect(dumped).not.toContain("codex-token");
    const workAccount = accounts.find((account) => account.id === "claude-work");
    expect(workAccount).toMatchObject({
      label: "Work",
      kind: "claude",
      email: "ada@example.com",
      plan: "max",
      dir: work,
      signedIn: true,
      active: true,
      panes: ["p1", "p2"],
    });
    expect(workAccount?.fuel[0]).toMatchObject({ key: "session", label: "5H", left: 5 });
    const codex = accounts.find((account) => account.id === "codex");
    expect(codex).toMatchObject({ kind: "codex", signedIn: true, panes: ["p3"], email: undefined });
    expect(accounts.some((account) => account.kind === "cursor")).toBe(false);
    const agents = [{ paneId: "p1" }, { paneId: "p9" }] as Agent[];
    stampAccounts(agents, accounts);
    expect(agents[0]).toMatchObject({ accountId: "claude-work", lowFuel: true });
    expect(agents[1]).toMatchObject({ accountId: undefined, lowFuel: false });
  });

  test("fuel percent changes do not restamp an Agent; a new account does", () => {
    const agents = [{ paneId: "p1", accountId: "claude-work", lowFuel: true }] as Agent[];
    const account: AccountInfo = { id: "claude-work", label: "Work", kind: "claude", signedIn: true, active: true, fuel: [{ key: "session", label: "5H", left: 4 }], panes: ["p1"] };
    expect(accountsAffectAgents(agents, [account])).toBe(false);
    expect(accountsAffectAgents(agents, [{ ...account, fuel: [{ key: "session", label: "5H", left: 40 }] }])).toBe(true);
  });

  test("a pane's process is asked once while its pid stays the same", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-accounts-ps-"));
    const base = roots(dir);
    fs.mkdirSync(base.orchaDir, { recursive: true });
    let calls = 0;
    const link = {
      state: () => ({ agents: [{ paneId: "ps-pane", kind: "claude" }] }),
      request: async () => {
        calls += 1;
        return { process_info: {} };
      },
    };
    await readOfficeAccounts(link as never, base);
    await readOfficeAccounts(link as never, base);
    expect(calls).toBe(1);
  });

  test("a ps line yields only the config dir", () => {
    expect(configDirFromPs("claude CLAUDE_CONFIG_DIR=/tmp/work --resume")).toBe("/tmp/work");
    expect(configDirFromPs("claude")).toBeUndefined();
  });
});

describe("account route and push", () => {
  test("GET /api/accounts and the socket follow the temp files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-accounts-http-"));
    const base = roots(dir);
    fs.mkdirSync(base.orchaDir, { recursive: true });
    fs.mkdirSync(base.limitsDir, { recursive: true });
    const state = emptyOffice("/tmp/sock");
    state.agents = [{
      paneId: "p1", workspaceId: "w1", tabId: "t1", kind: "claude", name: "Ada", status: "idle", orchaStatus: "idle",
      stateChangeSeq: 1, agentKey: "p1", skin: "headset", interactiveReady: true, launchPending: false, focused: false,
    }];
    const link: OfficeLink = {
      state: () => state,
      request: async () => { throw new Error("no process"); },
      reemit() {},
      updateLocal() {},
      dropSocket() {},
      stop() {},
    };
    const server = startServer({
      link,
      activity: openActivity(path.join(dir, "activity.jsonl")),
      distDir: dir,
      port: 39000 + (process.pid % 1000),
      open: false,
      token: "accounts-token",
      accountRoots: base,
      accountPollMs: 40,
    });
    const headers = { authorization: "Bearer accounts-token" };
    const messages: ServerMessage[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, ["easy-job.accounts-token"]);
    ws.addEventListener("message", (event) => messages.push(JSON.parse(String(event.data)) as ServerMessage));
    try {
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", () => reject(new Error("websocket failed")));
      });
      write(path.join(base.orchaDir, "config.json"), JSON.stringify({
        accounts: [{ id: "claude-main", kind: "claude", label: "Main" }],
      }));
      write(path.join(base.orchaDir, "claude-accounts", "claude-main.json"), JSON.stringify({ emailAddress: "main@example.com", accessToken: "no-leak" }));
      let body: AccountInfo[] = [];
      for (let i = 0; i < 40 && !body.some((account) => account.id === "claude-main"); i += 1) {
        body = (await (await fetch(`http://127.0.0.1:${server.port}/api/accounts`, { headers })).json()) as AccountInfo[];
        await Bun.sleep(20);
      }
      expect(body[0]).toMatchObject({ id: "claude-main", email: "main@example.com", panes: ["p1"], signedIn: true });
      expect(JSON.stringify(body)).not.toContain("no-leak");
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline && !messages.some((message) => message.type === "accounts" && message.accounts.some((account) => account.id === "claude-main"))) {
        await Bun.sleep(20);
      }
      const pushed = messages.find((message) => message.type === "accounts" && message.accounts.some((account) => account.email === "main@example.com"));
      expect(pushed?.type).toBe("accounts");
      expect(JSON.stringify(pushed)).not.toContain("no-leak");
    } finally {
      ws.close();
      server.stop();
    }
  });
});
