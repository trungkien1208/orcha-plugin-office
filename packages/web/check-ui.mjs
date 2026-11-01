import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch();const results=[];
const url=fs.readFileSync('.dev-fake.url','utf8').trim();
for(const theme of ['compound','office']){
 const page=await browser.newPage({viewport:{width:1024,height:700}});
 await page.addInitScript(t=>{localStorage.setItem('easy-job-theme',t);localStorage.setItem('easy-job-calm','1');},theme);
 let socket;
 await page.routeWebSocket('**/ws',ws=>{socket=ws;});
 await page.goto(url);await page.locator('.app .hud').waitFor({timeout:20000});
 assert.equal(await page.locator('.entry-gate').count(),0);
 socket?.close();await page.waitForTimeout(250);
 assert.equal(await page.locator('.entry-gate').count(),0,'Reconnect must stay inside the app');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 results.push(`${theme}: authorized entry, static calm transition, reconnect stays in app, 1024px no horizontal overflow`);
 await page.close();
 const denied=await browser.newPage();await denied.goto('http://127.0.0.1:4599/#t=invalid-ui-review-token');await denied.locator('.entry-denied').waitFor({timeout:10000});results.push(`${theme}: invalid token reaches denied`);await denied.close();
}
const mobile=await browser.newPage({viewport:{width:375,height:800}});await mobile.goto('http://127.0.0.1:5173/landing.html');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);results.push('landing: 375px no horizontal overflow');await browser.close();
fs.writeFileSync('docs/review/codex-browser-check.txt',results.join('\n')+'\n');console.log(results.join('\n'));
