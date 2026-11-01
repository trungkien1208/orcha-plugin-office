import { describe, expect, test } from "bun:test";
import type { Agent, ModelOption } from "@easy-job/shared";
import { emptyOffice } from "@easy-job/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseSessionModel, readSessionModel } from "../src/conversation/model-state.ts";
import { codexFooterModel, cursorFooterModel, currentModelState } from "../src/orcha/model-state.ts";
import type { OfficeLink } from "../src/orcha/link.ts";

const models:ModelOption[]=[{id:"gpt-real",name:"GPT-Real",efforts:["medium","high"],fast:true},{id:"gpt-real-terra",name:"GPT-Real Terra",efforts:["medium"],fast:true}];
const catalog=async()=>({kind:"codex",models,source:"test",fetchedAt:""});
const agent:Agent={paneId:"p1",workspaceId:"w1",tabId:"t1",kind:"codex",name:"Ada",status:"working",orchaStatus:"working",stateChangeSeq:1,agentKey:"session-one",skin:"headset",interactiveReady:true,launchPending:false,focused:false};

test("Cursor current settings resolve the footer to a real advertised variant",()=>{
  const options:ModelOption[]=[{id:"grok-real",name:"Grok Real",efforts:["high"],fast:true,variants:[{model:"grok-real-high-fast",name:"Grok Real High Fast",effort:"high",fast:true}]}];
  expect(cursorFooterModel("  → Follow up\n▀▀▀▀▀▀▀\n Grok Real 500K High Fast · MAX · 30% · 2 files\n",options)).toEqual({model:"grok-real-high-fast",effort:"high",fast:true});
  expect(cursorFooterModel("Grok Real High Fast · MAX · message text\n → Follow up\n",options)).toEqual({});
});

test("current Codex model is read only from the pane footer below its composer",()=>{
  expect(codexFooterModel("assistant discussed GPT-Real high · example\n› Next task\n  GPT-Real medium · ~12k tokens\n? shortcuts\n",models)).toEqual({model:"gpt-real",effort:"medium"});
  expect(codexFooterModel("› Task\nGPT-Real Terra medium fast · ~12k\n",models)).toEqual({model:"gpt-real-terra",effort:"medium",fast:true});
  expect(codexFooterModel("› Task\nGPT-Real high · ~12k · Standard\n",models)).toEqual({model:"gpt-real",effort:"high",fast:false});
  expect(codexFooterModel("GPT-Real high · text from a message, not the footer",models)).toEqual({});
  expect(codexFooterModel("GPT-Real high · message\n› Task\n",models)).toEqual({});
});

test("session model settings follow configuration records and never tool output",()=>{
  const raw=[
    {type:"turn_context",payload:{model:"gpt-real",effort:"medium"}},
    {type:"event_msg",payload:{type:"thread_settings_applied",thread_settings:{model:"gpt-real",reasoning_effort:"high",service_tier:"priority"}}},
    {type:"response_item",payload:{type:"function_call_output",output:{model:"fake-from-tool",effort:"low"}}},
  ].map(l=>JSON.stringify(l)).join("\n");
  expect(parseSessionModel(raw,"codex")).toEqual({model:"gpt-real",effort:"high",fast:true});
  expect(parseSessionModel(`${raw}\n${JSON.stringify({type:"turn_context",payload:{model:"gpt-other",effort:"low"}})}`,"codex")).toEqual({model:"gpt-other",effort:"low"});
  expect(parseSessionModel([JSON.stringify({type:"assistant",message:{model:"real-opus"}}),JSON.stringify({type:"assistant",isSidechain:true,message:{model:"wrong-subagent"}})].join("\n"),"claude")).toEqual({model:"real-opus"});
});

test("session file metadata refreshes on append",()=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),"ej-model-state-")),file=path.join(home,"rollout.jsonl");
  try {
    fs.writeFileSync(file,`${JSON.stringify({type:"turn_context",payload:{model:"gpt-real",effort:"medium"}})}\n`);
    expect(readSessionModel({kind:"codex",file})).toEqual({model:"gpt-real",effort:"medium"});
    fs.appendFileSync(file,`${JSON.stringify({type:"event_msg",payload:{type:"thread_settings_applied",thread_settings:{model:"gpt-real",effort:"high",serviceTier:"priority"}}})}\n`);
    expect(readSessionModel({kind:"codex",file})).toEqual({model:"gpt-real",effort:"high",fast:true});
  } finally {fs.rmSync(home,{recursive:true,force:true});}
});

test("a pane without session ID still exposes its actual model with non-scrolling reads",async()=>{
  const calls:unknown[]=[];
  const link={state:()=>({...emptyOffice("/tmp/sock"),agents:[agent]}),request:async(method:string,params:unknown)=>{calls.push({method,params});return {read:{text:"› Task\n GPT-Real medium · ~10k\n"}};}} as unknown as OfficeLink;
  expect(await currentModelState(link,"p1",undefined,catalog)).toMatchObject({paneId:"p1",agentKey:"session-one",model:"gpt-real",effort:"medium",source:"terminal-footer"});
  expect(calls).toEqual([{method:"agent.read",params:{target:"p1",source:"visible",format:"text",strip_ansi:true,lines:80}}]);
});

test("a read from the previous session cannot update a replacement Agent",async()=>{
  let current=agent,release:(value:unknown)=>void=()=>{};
  const read=new Promise(resolve=>{release=resolve;});
  const link={state:()=>({...emptyOffice("/tmp/sock"),agents:[current]}),request:async()=>read} as unknown as OfficeLink;
  const result=currentModelState(link,"p1",undefined,catalog);
  current={...agent,agentKey:"replacement"};release({read:{text:"› Task\nGPT-Real medium · ~10k\n"}});
  await expect(result).rejects.toMatchObject({status:409});
});

test("removing Fast from a known Codex footer confirms Standard for that same session",async()=>{
  const current={...agent,agentKey:"speed-change"};
  let text="› Task\nGPT-Real medium fast · ~10k\n";
  const link={state:()=>({...emptyOffice("/tmp/sock"),agents:[current]}),request:async()=>({read:{text}})} as unknown as OfficeLink;
  expect(await currentModelState(link,"p1",undefined,catalog)).toMatchObject({fast:true});
  text="› Task\nGPT-Real medium · ~10k\n";
  expect(await currentModelState(link,"p1",undefined,catalog)).toMatchObject({model:"gpt-real",effort:"medium",fast:false});
  current.agentKey="new-session-with-no-speed-report";
  expect((await currentModelState(link,"p1",undefined,catalog)).fast).toBeUndefined();
});

describe("incremental session model reads", () => {
  test("an appended record updates the cached settings without re-reading the file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ej-model-"));
    const file = path.join(dir, "s.jsonl");
    const line = (model: string) => `${JSON.stringify({ type: "assistant", message: { model } })}\n`;
    fs.writeFileSync(file, line("claude-opus-5-5"));
    expect(readSessionModel({ kind: "claude", file }).model).toBe("claude-opus-5-5");
    fs.appendFileSync(file, `${JSON.stringify({ type: "user", message: { content: "hi" } })}\n`);
    expect(readSessionModel({ kind: "claude", file }).model).toBe("claude-opus-5-5");
    fs.appendFileSync(file, line("claude-sonnet-5-5"));
    expect(readSessionModel({ kind: "claude", file }).model).toBe("claude-sonnet-5-5");
  });
});
