import {chromium} from '@playwright/test';
import {makeDemoOffice} from './src/floor/demo-state.ts';
const task=process.argv[2],browser=await chromium.launch();
for(const theme of ['compound','office'])for(const [width,height]of [[1440,900],[1024,700]]){
 const office=makeDemoOffice(3);office.agents.forEach((a,i)=>{a.model='sonnet';Object.assign(a,{lowFuel:true});a.status=i===1?'working':'idle';});
 const accounts=[{id:'personal',label:'Personal',kind:'claude',email:'owner@example.test',plan:'Pro',signedIn:true,active:true,fuel:[{key:'session',label:'5H',left:65}],panes:office.agents.map(a=>a.paneId)},{id:'team',label:'Team',kind:'claude',email:'team@example.test',plan:'Team',signedIn:true,active:false,fuel:[{key:'session',label:'5H',left:82}],panes:[]},{id:'expired',label:'Studio',kind:'claude',signedIn:false,active:false,fuel:[],panes:[]}];
 Object.assign(office,{capabilities:{accountApi:false,handoff:true}});
 const page=await browser.newPage({viewport:{width,height}});let wire;
 await page.addInitScript(t=>{localStorage.setItem('easy-job-theme',t);localStorage.setItem('easy-job-calm','1');},theme);
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;const data=path==='/api/state'?office:path==='/api/accounts'?accounts:path.endsWith('/account/plan')?{mode:route.request().postDataJSON().mode,allowed:true,alsoMoves:[],sessionLinked:true,needsIdle:true}:path==='/api/activity'?[]:path.endsWith('/context')?{git:null,fuel:{label:'Personal',windows:[{key:'session',label:'5H',left:65}]}}:path.endsWith('/thread')?{items:[{id:'team-1',paneId:'demo:p0',role:'agent',at:Date.now()-60000,text:'API review is ready. Please check the retry behavior.'},{id:'team-2',paneId:'demo:p1',from:'demo:p0',role:'user',at:Date.now()-30000,text:'Could you check the retry behavior?'},{id:'team-3',paneId:'demo:p1',role:'agent',at:Date.now(),text:'The retry path passes. I will cover the timeout next.'}]}:path.includes('/conversation')?{items:[{id:'msg-1',role:'agent',at:Date.now(),text:'The API review is ready. Please check the retry behavior.'}],terminal:false}:{};return route.fulfill({status:Object.keys(data).length===0?404:200,json:data});});
 await page.routeWebSocket('**/ws',ws=>{wire=ws;});await page.goto('http://127.0.0.1:5174/#t=review');await page.locator('.app .hud').waitFor();await page.waitForTimeout(1400);
 if(task==='k6'){await page.getByRole('button',{name:'team',exact:true}).click();await page.getByRole('log',{name:'Team conversation'}).waitFor();await page.getByText('The retry path passes.',{exact:false}).waitFor();}
 if(task==='k5'){await page.getByRole('button',{name:'Low fuel: hand off?',exact:true}).first().click();await page.getByRole('dialog',{name:/Hand off /}).waitFor();}
 if(task==='k4'){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Accounts…',exact:true}).click();await page.getByRole('dialog',{name:'Settings · Accounts'}).waitFor();}
 if(task==='k3'){await page.getByRole('button',{name:/Switch account for/}).click();await page.getByText(/team@example.test/).waitFor();await page.screenshot({path:`docs/review/codex-k3-${theme}-${width}-list.png`});await page.getByRole('button',{name:'Choose',exact:true}).nth(1).click();await page.getByText('Plan ready',{exact:true}).waitFor();}
 if(task==='k2'){await page.getByRole('button',{name:/Model:/}).first().click();}
 if(task==='k1'){wire?.send(JSON.stringify({type:'state',version:2,state:{...office,orcha:{...office.orcha,connected:false}}}));await page.getByText("Orcha isn't running",{exact:true}).first().waitFor();}
 await page.screenshot({path:`docs/review/codex-${task}-${theme}-${width}.png`});
 if(task==='k6'){
  await page.getByRole('button',{name:'chat',exact:true}).click();await page.getByRole('button',{name:'Ask a teammate',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.screenshot({path:`docs/review/codex-k6-${theme}-${width}-ask.png`});await page.getByRole('button',{name:'Close dialog',exact:true}).click();const area=page.getByRole('textbox',{name:/Message red-cap/});await area.fill('@hea');await page.getByRole('option',{name:'@headset',exact:true}).click();await area.fill('@bun');await page.getByRole('listbox',{name:'Project teammates'}).waitFor();await page.screenshot({path:`docs/review/codex-k6-${theme}-${width}-mentions.png`});
 }
 await page.close();
}
await browser.close();
