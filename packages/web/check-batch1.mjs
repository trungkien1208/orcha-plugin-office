import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeDemoOffice} from './src/floor/demo-state.ts';
const browser=await chromium.launch(),results=[];
async function setup(options={}){
 const page=await browser.newPage({viewport:{width:1024,height:700}}),office=makeDemoOffice(3),writes=[];
 office.agents.forEach(a=>{a.model='sonnet';a.status='idle';Object.assign(a,{lowFuel:true});});
 Object.assign(office,{capabilities:{accountApi:false,handoff:options.handoff??true}});
 const accounts=[{id:'personal',label:'Personal',kind:'claude',signedIn:true,active:true,fuel:[],panes:office.agents.map(a=>a.paneId)},{id:'team',label:'Team',kind:'claude',signedIn:true,active:false,fuel:[],panes:[]}];
 await page.addInitScript(()=>{localStorage.setItem('easy-job-calm','1');localStorage.setItem('easy-job-theme','office');});
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,body=request.postDataJSON();if(request.method()==='POST')writes.push({path,body});
  let status=200,data={};
  if(path==='/api/state')data=office;
  else if(path==='/api/accounts'){status=options.unavailable?404:200;data=accounts;}
  else if(path==='/api/activity')data=[];
  else if(path.endsWith('/context'))data={git:null,fuel:{label:'Personal',windows:[{key:'session',label:'5H',left:5}]}};
  else if(path.endsWith('/question'))data={text:'',choices:[]};
  else if(path.includes('/conversation'))data={items:[{id:'answer',at:100,role:'agent',text:'<script>window.batchExecuted=true</script>Review the API.'}],terminal:false};
  else if(path.endsWith('/account/plan')){await new Promise(r=>setTimeout(r,250));data={mode:body.mode,allowed:true,alsoMoves:[],sessionLinked:options.linked??true,needsIdle:false};}
  else if(path.endsWith('/model')){status=404;data={error:'Not found'};}
  else if(path.endsWith('/prompt')&&path.startsWith('/api/projects/'))data={results:body.to.map((paneId,i)=>({paneId,ok:!options.partial||i===0,...(options.partial&&i?{error:'Busy'}:{})}))};
  else if(path.endsWith('/thread'))data={items:url.searchParams.has('before')?[{id:'older',paneId:'demo:p0',role:'agent',at:0,text:'Older discussion'}]:[{id:'1',paneId:'demo:p0',role:'agent',at:2,text:'Review the API.'},{id:'2',paneId:'demo:p1',from:'demo:p0',role:'user',at:3,text:'Can you review this?'}]};
  else if(path==='/api/skills')data=[];
  else if(path.endsWith('/prompt')||path.endsWith('/seen'))data={ok:true};
  else{status=404;data={error:'Not found'};}
  await route.fulfill({status,json:data});
 });
 await page.routeWebSocket('**/ws',()=>{});await page.goto('http://127.0.0.1:5174/#t=contract-test');await page.locator('.app .hud').waitFor();await page.waitForTimeout(300);return {page,writes,office};
}
{
 const {page,writes}=await setup();await page.getByRole('button',{name:/Model:/}).click();await page.getByRole('dialog').getByRole('combobox').selectOption('opus');await page.getByRole('button',{name:'Change model',exact:true}).click();await page.getByText('Model change sent.',{exact:false}).first().waitFor();assert.equal(writes.filter(w=>w.path.endsWith('/model')).length,1);assert.equal(writes.filter(w=>w.path.endsWith('/prompt')&&w.body.text==='/model opus').length,1);results.push('K2: 404 model fallback sends one idle slash command');await page.close();
}
{
 const {page,writes}=await setup({linked:false});await page.getByRole('button',{name:/Switch account for/}).click();await page.getByRole('button',{name:'Choose',exact:true}).nth(1).click();await page.getByText('Session cannot be linked',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirm switch',exact:true}).isDisabled(),true);assert.equal(await page.locator('option[value="keychain"]').evaluate(e=>e.disabled),true);assert.equal(writes.filter(w=>w.path.endsWith('/account')).length,0);results.push('K3: unlinkable session and unavailable Keychain block mutation after dry run');await page.close();
}
{
 const {page}=await setup({unavailable:true});await page.getByRole('button',{name:/Switch account for/}).click();await page.getByText('Feature unavailable:',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Choose',exact:true}).count(),0);results.push('K3/K4: account 404 shows unavailable with no fabricated account choices');await page.close();
}
{
 const {page,writes}=await setup({handoff:false});await page.getByRole('button',{name:'Low fuel: hand off?',exact:true}).first().click();assert.equal(await page.getByRole('button',{name:'Confirm hand off',exact:true}).isDisabled(),true);assert.equal(writes.filter(w=>w.path.endsWith('/handoff')).length,0);results.push('K5: missing handoff capability prevents requests');await page.close();
}
{
 const {page,writes}=await setup({partial:true});const area=page.getByRole('textbox',{name:/Message headset/});await area.fill('@red');await page.getByRole('option',{name:'@red-cap',exact:true}).click();await area.fill('@bun');await page.getByRole('option',{name:'@bun',exact:true}).click();await area.fill('Review this change');await page.locator('.agent-row[title^="red-cap"]').click();await page.getByRole('textbox',{name:/Message red-cap/}).waitFor();await page.locator('.agent-row[title^="headset"]').click();await page.getByRole('button',{name:'Remove bun',exact:true}).waitFor();assert.equal(await area.inputValue(),'Review this change');await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByText('Sent to 1 Agents.',{exact:true}).waitFor();assert.equal(writes.filter(w=>w.path.startsWith('/api/projects/')&&w.path.endsWith('/prompt')).length,1);assert.equal(await area.inputValue(),'Review this change');assert.equal(await page.getByRole('button',{name:'Remove bun',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Remove red-cap',exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.batchExecuted),undefined);results.push('K6: explicit @mentions send once, retain only failed targets and draft; agent HTML stays inert');await page.close();
}
{
 const {page,writes}=await setup();await page.getByRole('button',{name:'Ask a teammate',exact:true}).click();assert.equal(writes.filter(w=>w.path.startsWith('/api/projects/')&&w.path.endsWith('/prompt')).length,0);await page.getByRole('button',{name:'Confirm and send',exact:true}).click();await page.getByText('Sent to 1 teammate.',{exact:true}).waitFor();assert.equal(writes.find(w=>w.path.startsWith('/api/projects/')&&w.path.endsWith('/prompt'))?.body.text.startsWith('Please review:'),true);results.push('K6: Ask a teammate requires confirmation before forwarding');await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'team',exact:true}).click();await page.getByText('headset → red-cap',{exact:true}).waitFor();assert.equal(await page.locator('.team-composer input:checked').count(),5);await page.getByRole('button',{name:'Load earlier',exact:true}).click();await page.getByText('Older discussion',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(async()=>{const {FloorScene}=await import('/src/floor/FloorScene.ts');FloorScene.prototype.teamFlight.call({ready:true,reduced:true,get workers(){throw new Error('Calm mode attempted to allocate a plane');}},'a','b');});results.push('K6: attributed thread, paging, max-five recipients, 1024px fit and calm no-plane guard');await page.close();
}
await browser.close();fs.writeFileSync('docs/review/codex-batch1-check.txt',results.join('\n')+'\n');console.log(results.join('\n'));
