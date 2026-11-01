import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

async function choose(page:Page,label:string,option:string) {
  await page.getByRole("combobox",{name:label,exact:true}).click();
  await page.getByRole("option",{name:option,exact:true}).click();
}

async function openAgent(page:Page) {
  await page.goto(fs.readFileSync(".dev-fake.url","utf8").trim());
  await expect(page.locator(".app:not([inert])")).toBeVisible();
  await page.getByRole("button",{name:"Conversation",exact:true}).click();
  await page.locator(".prail .agent-row.idle").first().click();
}

const catalog=(models:unknown[])=>({json:{kind:"claude",source:"Native catalog",fetchedAt:"",models}});

test("account pill opens a popover with the accounts, not a dialog",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.route("**/api/accounts",route=>route.fulfill({json:[{id:"work",label:"Work account",kind:"claude",signedIn:true,active:true,panes:[],fuel:[{key:"session",label:"5H",left:80}]}]}));
  // The bridge also pushes the machine's real accounts over the socket; keep only the mocked list in this test.
  await page.routeWebSocket(/\/ws/,ws=>{const server=ws.connectToServer();server.onMessage(m=>{if(typeof m==="string"&&m.includes('"type":"accounts"'))return;ws.send(m);});});
  await openAgent(page);
  const pill=page.getByRole("button",{name:/^Switch account for /});
  await expect(pill).toBeVisible();await pill.click();
  const panel=page.getByRole("dialog",{name:/^Switch account for /});
  await expect(panel.getByText("Work account",{exact:false})).toBeVisible();
  const bounds=await panel.boundingBox();expect(bounds && bounds.x>=0 && bounds.x+bounds.width<=375).toBe(true);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);await expect(pill).toBeFocused();
});

test("model pill shows the session settings and a queued change until the Agent reports it",async({page})=>{
  let observed={model:"real-sol",effort:"high",fast:true};
  await page.route("**/api/models?*",route=>route.fulfill(catalog([{id:"real-sol",name:"Real Sol",efforts:["low","high"],fast:true},{id:"real-luna",name:"Real Luna",efforts:["medium"],fast:false}])));
  await page.route("**/api/agents/*/model-state",async route=>{const response=await route.fetch(),state=await response.json();await route.fulfill({json:{...state,...observed,source:"terminal-footer",observedAt:Date.now()}});});
  await page.route("**/api/agents/*/model",route=>route.fulfill({json:{queued:true}}));
  await openAgent(page);
  const pill=page.getByRole("button",{name:/^Model for /});
  await expect(pill).toContainText("Real Sol");await expect(pill).toContainText("High");await expect(pill).toContainText("⚡");
  await pill.click();await page.getByRole("option",{name:/Real Luna/}).click();await page.getByRole("button",{name:"Apply",exact:true}).click();
  await expect(pill).toContainText("Queued");
  observed={model:"real-luna",effort:"medium",fast:false};
  await expect(pill).not.toContainText("Queued",{timeout:10000});
  await expect(pill).toContainText("Real Luna");await expect(pill).toContainText("Medium");await expect(pill).not.toContainText("⚡");
});

test("one Apply sends model, effort and Fast together, and only what the model supports",async({page})=>{
  const sent:unknown[]=[];
  await page.route("**/api/models?*",route=>route.fulfill(catalog([{id:"real-opus",name:"Real Opus",efforts:["low","high","max"],fast:true},{id:"real-sonnet",name:"Real Sonnet",efforts:["low","high"],fast:false}])));
  await page.route("**/api/agents/*/model",route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:{queued:false}});});
  await openAgent(page);
  const pill=page.getByRole("button",{name:/^Model for /});
  await pill.click();
  await page.getByRole("option",{name:/Real Opus/}).click();
  await page.getByRole("radio",{name:"High",exact:true}).check();
  await page.getByRole("switch",{name:"Fast mode"}).click();
  expect(sent).toHaveLength(0);
  await page.getByRole("button",{name:"Apply",exact:true}).click();
  await expect.poll(()=>sent).toEqual([{model:"real-opus",effort:"high",fast:true}]);
  await pill.click();
  await page.getByRole("option",{name:/Real Sonnet/}).click();
  await expect(page.getByRole("switch",{name:"Fast mode"})).toHaveCount(0);
  await expect(page.getByRole("radio",{name:"Max",exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(sent).toHaveLength(1);
});

test("model popover supports search, keyboard, escape and outside click",async({page})=>{
  await page.setViewportSize({width:1024,height:700});
  const sent:unknown[]=[];
  await page.route("**/api/models?*",route=>route.fulfill(catalog([{id:"real-opus",name:"Real Opus",description:"For complex work",efforts:[],fast:false},{id:"real-sonnet",name:"Real Sonnet",description:"For everyday tasks",efforts:[],fast:false}])));
  await page.route("**/api/agents/*/model",route=>{sent.push(route.request().postDataJSON());return route.fulfill({json:{queued:false}});});
  await openAgent(page);
  const pill=page.getByRole("button",{name:/^Model for /});
  await pill.click();
  const search=page.getByRole("combobox",{name:"Search models"});
  await expect(search).toBeFocused();
  await search.fill("sonnet");
  await expect(page.getByRole("option",{name:/Real Opus/})).toHaveCount(0);
  const bounds=await page.locator(".pill-panel").boundingBox();
  expect(bounds && bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=1024 && bounds.y+bounds.height<=700).toBe(true);
  // cmdk highlights the best match as you type: Enter picks it, Ctrl+Enter applies.
  await search.press("Enter");await page.keyboard.press("Control+Enter");
  await expect.poll(()=>sent.at(-1)).toEqual({model:"real-sonnet"});
  await expect(page.locator(".pill-panel")).toHaveCount(0);
  await expect(pill).toBeFocused();
  await pill.click();await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded","false");
  await pill.click();await page.locator(".conv-head .name").click();
  await expect(page.locator(".pill-panel")).toHaveCount(0);
});

test("header stays two rows and the pills fit at every width",async({page})=>{
  await page.route("**/api/models?*",route=>route.fulfill(catalog([{id:"real-sol",name:"Real Sol",efforts:["low","medium"],fast:true}])));
  for(const width of [1440,1024,768,375]){
    await page.setViewportSize({width,height:800});
    await openAgent(page);
    await expect(page.getByRole("button",{name:/^Model for /})).toBeVisible();
    const result=await page.evaluate(()=>{
      const head=document.querySelector(".conv-head")?.getBoundingClientRect(),composer=document.querySelector(".composer")?.getBoundingClientRect();
      const pills=[...document.querySelectorAll(".agent-pills .pill")].map(e=>e.getBoundingClientRect());
      return{head:head?.height ?? 0,overflow:document.documentElement.scrollWidth>innerWidth,fits:!!composer&&pills.every(r=>r.left>=composer.left-1&&r.right<=composer.right+1)};
    });
    expect(result.overflow).toBe(false);expect(result.fits).toBe(true);expect(result.head).toBeLessThanOrEqual(64);
  }
});

test("new Agent carries model, effort and Fast through the launch form",async({page})=>{
  let launched:unknown;
  await page.route("**/api/models?*",route=>route.fulfill({json:{kind:"codex",source:"Codex catalog",fetchedAt:"",models:[{id:"real-sol",name:"Real Sol",efforts:["low","high","ultra"],defaultEffort:"low",fast:true}]}}));
  await page.route("**/api/projects/*/agents",route=>{launched=route.request().postDataJSON();return route.fulfill({json:{paneId:"new-test-agent"}});});
  await page.goto(fs.readFileSync(".dev-fake.url","utf8").trim());
  await expect(page.locator(".app:not([inert])")).toBeVisible();
  await page.getByRole("button",{name:"Conversation",exact:true}).click();
  await page.locator(".rail-foot .btn.primary").click();
  const dialog=page.locator("form.launch");
  await dialog.getByRole("radio",{name:"Codex"}).check();
  await choose(page,"Model","Real Sol");
  await dialog.getByRole("radio",{name:"Ultra",exact:true}).check();
  await page.getByRole("switch",{name:"Fast mode"}).click();
  await dialog.getByRole("button",{name:"Start agent",exact:true}).click();
  await expect.poll(()=>launched).toMatchObject({kind:"codex",model:"real-sol",effort:"ultra",fast:true});
});
