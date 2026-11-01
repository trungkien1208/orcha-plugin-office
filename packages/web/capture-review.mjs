import { chromium } from '@playwright/test';
import fs from 'node:fs';
const task=process.argv[2], browser=await chromium.launch({headless:true});
const token=new URL(fs.readFileSync('.dev-fake.url','utf8').trim()).hash;
for(const theme of ['compound','office'])for(const [width,height,suffix]of [[1440,900,''],...(task==='u3'?[[1024,700,'-1024']]:[]),...(task==='u4'?[[375,800,'-375']]:[])]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.addInitScript(t=>{localStorage.setItem('easy-job-theme',t);localStorage.setItem('easy-job-calm','1');},theme);
 await page.goto((task==='u4'?'http://127.0.0.1:5173/':'http://127.0.0.1:4599/')+(task==='u4'?'landing.html':task==='u5'?'#home':token));
 if(task!=="u4"&&task!=="u5")await page.locator(".app .hud").waitFor({timeout:20000});
 await page.waitForTimeout(2500);
 await page.screenshot({path:`docs/review/codex-${task}-${theme}${suffix}.png`});await page.close();
}
if(task==='u5')for(const theme of ['compound','office'])for(const state of ['connecting','approved','denied','down']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.addInitScript(t=>{localStorage.setItem('easy-job-theme',t);localStorage.setItem('easy-job-calm','1');},theme);await page.goto(`http://127.0.0.1:5173/gate.html?state=${state}`);await page.waitForTimeout(1200);await page.screenshot({path:`docs/review/codex-u5-${theme}-${state}.png`});await page.close();
}
await browser.close();
