import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1120},deviceScaleFactor:1});
if (process.argv.includes('--reference')) { await page.goto('file:///Users/sam/Project/PartyAgent-2/docs/style/style-guide.html'); await page.waitForTimeout(500); await page.screenshot({path:new URL('../floor-style-reference.png',import.meta.url).pathname,fullPage:true}); }
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5174/src/floor/demo.html?demo');
await page.locator('.ej-floor-hud').filter({hasText:'6 Projects'}).waitFor();
await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
if (process.argv[2]?.includes('boss')) {
 await page.evaluate(()=>{const s=document.querySelector('.ej-floor-canvas').floorScene,w=s.workers.get('demo-agent-1');s.boss.setPosition(w.sprite.x,w.sprite.y+32);});
 await page.getByRole('button',{name:'Zap',exact:true}).waitFor();
 for(const name of ['Buzzer','Whip crack','Zap','Coffee','High-five']){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(80);}
 if(await page.getByTestId('work-calls').textContent()!=='Work callbacks: 0')throw Error('fun action called bridge');
 await page.getByRole('button',{name:'Bonk',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 if(await page.getByTestId('work-calls').textContent()!=='Work callbacks: 0')throw Error('cancelled Bonk dispatched');
 await page.getByRole('button',{name:'Tap shoulder',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid=work-calls]')?.textContent==='Work callbacks: 1');
 if(await page.getByTestId('work-calls').textContent()!=='Work callbacks: 1')throw Error('tap did not dispatch');
 await page.getByRole('button',{name:'Zap',exact:true}).click();await page.waitForTimeout(100);
}
if (process.argv[2]?.includes('camera')) {
 const host=page.locator('.ej-floor-canvas'); await host.hover({position:{x:500,y:450}}); await page.mouse.wheel(0,-120); await page.waitForTimeout(250);
 if(await page.evaluate(()=>document.querySelector('.ej-floor-canvas').floorScene.controls.zoom)!==1.25)throw Error('integer zoom failed');
 await page.mouse.move(600,600);await page.mouse.down();await page.mouse.move(400,450,{steps:10});await page.mouse.up();
 await page.locator('.ej-demo-agent').nth(10).click();await page.waitForTimeout(500);
}
if (process.argv[2]?.includes('lifecycle')) {
 await page.getByRole('button',{name:'Add Agents to Project A'}).click(); await page.waitForTimeout(500);
 const state=await page.evaluate(()=>{const s=document.querySelector('.ej-floor-canvas').floorScene;return {benches:s.layout.benches.map(b=>({team:b.team,label:b.label,seats:b.seats})),workers:[...s.workers.values()].map(w=>({phase:w.phase,path:w.route?.points.length}))};});
 if(state.benches.length!==7 || state.benches.some(b=>b.seats!==4)) throw Error(JSON.stringify(state));
 console.log(state);
 await page.waitForFunction(()=>[...document.querySelector('.ej-floor-canvas').floorScene.workers.values()].every(w=>w.phase==='seated'));
 await page.evaluate(()=>document.querySelector('.ej-floor-canvas').floorScene.dataInput.callbacks.onSelectAgent('demo-agent-116'));
 await page.getByRole('button',{name:'Remove selected Agent'}).click();
 await page.waitForFunction(()=>!document.querySelector('.ej-floor-canvas').floorScene.workers.has('demo-agent-116'));
 if(await page.evaluate(()=>document.querySelector('.ej-floor-canvas').floorScene.layout.benches.length)!==7) throw Error('overflow Bench shrank');
}
await page.screenshot({path:new URL(`../${process.argv[2] || 'floor-02-tags.png'}`,import.meta.url).pathname,fullPage:true});
await fs.writeFile(new URL('../floor-browser-results.json',import.meta.url),JSON.stringify({errors,title:await page.title(),canvases:await page.locator('canvas').count()},null,2));
console.log({errors,title:await page.title(),canvases:await page.locator('canvas').count()});
await browser.close();if(errors.length)process.exitCode=1;
