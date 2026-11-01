// Build the landing and start its preview before running this check.
import {chromium} from "@playwright/test";
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const requests=[];page.on('request',request=>requests.push(new URL(request.url()).pathname));
 await page.goto('http://127.0.0.1:4173/?demo');
 await page.waitForFunction(()=>document.querySelector('.door-illustration')?.dataset.rendered==='true');
 await page.evaluate(()=>{
   window.doorAudit={phases:[],camera:[],hinge:[],inert:true};
   const entry=document.querySelector('.entry-screen'),stage=document.querySelector('.reception-door-stage');
   new MutationObserver(()=>{const phase=entry.dataset.phase;window.doorAudit.phases.push(phase);if(phase==='zooming')window.doorAudit.inert=document.querySelector('.workplace').inert;}).observe(entry,{attributes:true,attributeFilter:['data-phase']});
   new MutationObserver(()=>{if(stage.dataset.phase==='zooming')window.doorAudit.camera.push(Number(stage.dataset.cameraZ));window.doorAudit.hinge.push(Number(stage.dataset.hinge));}).observe(stage,{attributes:true,attributeFilter:['data-camera-z']});
 });
 await page.getByRole('button',{name:'Clock in',exact:true}).click();
 await page.locator('.entry-screen').waitFor({state:'detached'});
 const doorAudit=await page.evaluate(()=>window.doorAudit);
 if(['centering','loading','opening','zooming','revealing'].some(phase=>!doorAudit.phases.includes(phase))||!doorAudit.inert)throw Error(`Entrance phases failed: ${JSON.stringify(doorAudit)}`);
 if(doorAudit.camera.length<2||Math.min(...doorAudit.camera)>=Math.max(...doorAudit.camera)-.5||Math.max(...doorAudit.hinge)<1.5)throw Error('The 3D hinge/camera did not move through the doorway');
 await page.locator('.native-office[data-ready="true"]').waitFor();
 const host=page.locator('.native-floor-host');
 if(requests.some(path=>path.includes('/landing/rooms/')))throw Error('Generated room art is still being requested');
 const native=await host.evaluate(element=>{const s=element.floorScene;return {count:s.workers.size,chairs:s.room.chairs.size,seated:[...s.workers.values()].every(w=>w.sprite.x===w.desk.x&&w.sprite.y===w.desk.y),wallSides:new Set(s.children.list.map(item=>item.getData("wallSide")).filter(Boolean)).size,native:[...s.workers.values()].every(w=>w.sprite.texture.key.startsWith('character:'))};});
 if(native.count!==12||native.chairs!==12||!native.seated||!native.native||native.wallSides!==4)throw Error(`Native seating/art failed: ${JSON.stringify(native)}`);
 const firstFrame=await host.evaluate(e=>[...e.floorScene.workers.values()][0].sprite.frame.name);
 await page.waitForTimeout(230);
 if(firstFrame===await host.evaluate(e=>[...e.floorScene.workers.values()][0].sprite.frame.name))throw Error('Typing did not animate');
 const motion=await host.evaluate(async element=>{
   const scene=element.floorScene;scene.actions.stop();scene.boss.setPosition(320,336);scene.actions.walk(528,340);
   const started=performance.now();let changes=0,blocked=0,prior={x:scene.boss.x,y:scene.boss.y},maxStep=0;
   for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const {x,y}=scene.boss;if(x!==prior.x||y!==prior.y)changes++;maxStep=Math.max(maxStep,Math.hypot(x-prior.x,y-prior.y));prior={x,y};if(scene.layout.grid[Math.floor(y/32)]?.[Math.floor(x/32)]!==false)blocked++;}
   return {changes,blocked,maxStep,elapsed:performance.now()-started};
 });
 if(motion.changes<45||motion.blocked||motion.maxStep>9||motion.elapsed>2400)throw Error(`Native Boss movement failed: ${JSON.stringify(motion)}`);
 // Walking upward into an occupied Bench must stop at its collision boundary.
 await host.evaluate(e=>{e.floorScene.actions.stop();e.floorScene.boss.setPosition([...e.floorScene.workers.values()][0].desk.x,336);});
 await host.focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
 const collision=await host.evaluate(e=>{const s=e.floorScene,b=s.boss;return {y:b.y,blocked:s.layout.grid[Math.floor(b.y/32)]?.[Math.floor(b.x/32)]!==false};});
 if(collision.blocked||collision.y<320)throw Error(`Boss crossed a Bench: ${JSON.stringify(collision)}`);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const paused=await host.evaluate(e=>({x:e.floorScene.boss.x,y:e.floorScene.boss.y}));await page.waitForTimeout(250);
 if(JSON.stringify(paused)!==JSON.stringify(await host.evaluate(e=>({x:e.floorScene.boss.x,y:e.floorScene.boss.y}))))throw Error('Hidden office keeps moving');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'Calm off'}).click();await page.waitForTimeout(200);
 const frozen=await host.evaluate(e=>({x:e.floorScene.boss.x,y:e.floorScene.boss.y,frame:[...e.floorScene.workers.values()][0].sprite.frame.name}));await page.waitForTimeout(500);
 if(JSON.stringify(frozen)!==JSON.stringify(await host.evaluate(e=>({x:e.floorScene.boss.x,y:e.floorScene.boss.y,frame:[...e.floorScene.workers.values()][0].sprite.frame.name}))))throw Error('Calm did not freeze activity');
 // Each of the five pitch scenes must show a real, frozen frame in Calm.
 for(const vignette of await page.locator('.vignette').all()) {
   await vignette.scrollIntoViewIfNeeded();
   await page.waitForFunction(element=>element.querySelector('canvas').dataset.ready==='true',await vignette.elementHandle());
   if(await vignette.getAttribute('data-still')!=='true'||await vignette.getAttribute('data-running')!=='false')throw Error('Calm vignette is running');
   const image=await vignette.locator('canvas').evaluate(canvas=>canvas.toDataURL());
   await page.waitForTimeout(300);
   if(image!==await vignette.locator('canvas').evaluate(canvas=>canvas.toDataURL()))throw Error('Calm vignette changed frames');
 }
 await page.locator('.board-note-needs .vignette-action').click();
 if(await page.locator('.board-note-needs .vignette-action').getAttribute('aria-pressed')!=='true')throw Error('Notice-board Answer failed');
 await page.locator('.board-note-seen .vignette-action').click();
 if(await page.locator('.board-note-seen .vignette-action').getAttribute('aria-pressed')!=='true')throw Error('Notice-board Seen failed');
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.locator('.time-card').getByRole('button',{name:'Copy installation commands'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.time-card-row')].every(row=>Boolean(row.dataset.punched)));
 const punched=await page.locator('.time-card-row').evaluateAll(rows=>rows.every(row=>Boolean(row.dataset.punched)));
 if(!punched || await page.evaluate(()=>navigator.clipboard.readText())!=='bun install\nbun run install-local\neasy-job')throw Error('Time-card Copy/punch failed');
 await page.locator('.time-card').screenshot({path:'docs/review/landing-revamp-time-card-punched-1440.png'});
 // Selection fallback must contain only executable commands, with no row numbers or punch marks.
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked in test');}}});});
 await page.locator('.time-card').getByRole('button',{name:'Copy installation commands'}).click();
 if((await page.evaluate(()=>getSelection().toString())).replace(/\n\n/g,'\n').trim()!=='bun install\nbun run install-local\neasy-job')throw Error('Time-card selection fallback includes non-command text');
 await page.locator('.office-heading').scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Calm on'}).click();
 const active=page.locator('.board-note-bench .vignette');
 await active.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('.board-note-bench .vignette').dataset.running==='true');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>document.querySelector('.board-note-bench .vignette').dataset.running==='false');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('.office-heading').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('.vignette')].every(el=>el.dataset.running==='false'));
 await page.screenshot({path:'docs/review/landing-revamp-activity-1440.png'});await page.close();
 const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844}});
 await reduced.goto('http://127.0.0.1:4173/?demo');await reduced.getByRole('button',{name:'Clock in',exact:true}).press('Enter');await reduced.locator('.entry-screen').waitFor({state:'detached'});if(await reduced.getByRole('button',{name:'Calm on'}).getAttribute('aria-pressed')!=='true')throw Error('Reduced motion not respected');await reduced.close();
 const failure=await browser.newPage();let fail=true;
 await failure.route('**/office/characters/headset.png',route=>fail?route.abort():route.continue());
 await failure.goto('http://127.0.0.1:4173/');await failure.getByRole('button',{name:'Open the office door'}).click();await failure.getByRole('button',{name:'Try again'}).waitFor();fail=false;await failure.getByRole('button',{name:'Try again'}).click();await failure.locator('.entry-screen').waitFor({state:'detached'});await failure.close();
 console.log('Native art/chairs and four walls, smooth Boss motion, Bench collision, door zoom/retry, five Calm vignette stills, Answer/Seen, Copy/punch and selection fallback, hidden-tab/offscreen pause and reduced motion passed.');
} finally {await browser.close();}
