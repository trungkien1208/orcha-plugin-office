import { demoSnapshot, startFakeOrcha } from "./fake-orcha.ts";
import { emptyOffice, type Agent, type OfficeState, type SessionSnapshot } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ActionError } from "../src/actions.ts";
import { flushModels, requestModel } from "../src/model-queue.ts";
import { startServer } from "../src/http/server.ts";
import { startLink } from "../src/orcha/link.ts";
import { connect } from "../src/orcha/transport.ts";
import { openActivity } from "../src/state/activity.ts";
import { loadLocal } from "../src/state/local.ts";
import type { OfficeLink } from "../src/orcha/link.ts";

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "fixtures/snapshot-live.json"), "utf8")) as {
  result: { snapshot: SessionSnapshot };
};

function person(paneId: string, status: Agent["status"]): Agent {
  return {
    paneId, workspaceId: "w1", tabId: "t1", kind: "claude", name: paneId, status, orchaStatus: status,
    stateChangeSeq: 1, agentKey: paneId, skin: "headset", interactiveReady: true, launchPending: false, focused: false,
  };
}

describe("model queue", () => {
  test("queued effort and speed survive until idle and never cross a session change",async()=>{
    let current={...person("advanced","working"),kind:"codex"};
    const sent:string[]=[];
    const link={state:()=>({...emptyOffice("/tmp/sock"),agents:[current]}),request:async(_method:string,params:{text?:string})=>{sent.push(params.text ?? "");return {};},reemit(){},updateLocal(){},dropSocket(){},stop(){}} as unknown as OfficeLink;
    const activity=openActivity(path.join(fs.mkdtempSync(path.join(os.tmpdir(),"ej-model-settings-")),"activity.jsonl"));
    const catalog=async()=>({kind:"codex",source:"test",fetchedAt:"",models:[{id:"real-sol",name:"Sol",efforts:["low","high"],fast:true}]});
    await requestModel(link,current,"real-sol",activity,{effort:"high",fast:true},catalog);
    expect(sent).toEqual([]);
    current={...current,status:"idle"};
    await flushModels(link,[current],activity);
    expect(sent).toEqual(["/model real-sol --reasoning high --speed fast"]);
    await expect(requestModel(link,current,"real-sol",activity,{effort:"invalid"},catalog)).rejects.toMatchObject({status:400});
    expect(sent).toHaveLength(1);
    current={...current,status:"working"};
    await requestModel(link,current,"real-sol",activity,{effort:"low",fast:false},catalog);
    current={...current,status:"idle",agentKey:"replacement-session"};
    await flushModels(link,[current],activity);
    expect(sent).toHaveLength(1);
  });
  test("one pending model is replaced, then sent when the Agent is idle", async () => {
    const sent: string[] = [];
    let current = person("p1", "working");
    const link = {
      state: () => ({ ...emptyOffice("/tmp/sock"), agents: [current] }),
      request: async (_method: string, params: { text?: string }) => {
        sent.push(params.text ?? "");
        return {};
      },
      reemit() {},
      updateLocal() {},
      dropSocket() {},
      stop() {},
    } as unknown as OfficeLink;
    const activity = openActivity(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ej-model-")), "activity.jsonl"));
    expect(await requestModel(link, current, "opus", activity)).toEqual({ queued: true });
    expect(await requestModel(link, current, "sonnet", activity)).toEqual({ queued: true });
    expect(sent).toEqual([]);
    current = { ...current, status: "idle" };
    await flushModels(link, [current], activity);
    expect(sent).toEqual(["/model sonnet"]);
    await expect(requestModel(link, current, "bad name", activity)).rejects.toBeInstanceOf(ActionError);
    current = { ...current, status: "blocked" };
    await expect(requestModel(link, current, "opus", activity)).rejects.toMatchObject({ status: 409 });
  });

  test("an idle Agent is told /model through the fake Orcha", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-model-http-"));
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
      port: 40000 + (process.pid % 1000),
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
      const idle = state?.agents.find((agent) => agent.status === "idle");
      if (!idle) throw new Error("no idle agent");
      const response = await fetch(`http://127.0.0.1:${server.port}/api/agents/${encodeURIComponent(idle.paneId)}/model`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: "opus" }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ queued: false });
      const prompt = fake.calls.find((call) => call.method === "agent.prompt");
      expect(prompt?.params).toMatchObject({ target: idle.paneId, text: "/model opus" });
    } finally {
      server.stop();
      link.stop();
      await fake.close();
    }
  });
});
