// Build and preview the standalone landing first. Captures the requested review matrix.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  for (const [width,height] of [[390,844],[1024,700],[1440,900],[2560,1440]]) {
    const page = await browser.newPage({viewport:{width,height}});
    page.setDefaultTimeout(60000);
    await page.goto('http://127.0.0.1:4173/?demo');
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.querySelector('.door-illustration')?.dataset.rendered==='true');
    for(const theme of ['office','compound']) {
      // The controls are inert behind reception. Dispatch the same controlled select event for its review state.
      await page.getByRole('combobox',{name:'Office theme'}).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},theme);
      await page.screenshot({path:`docs/review/landing-revamp-reception-${theme}-${width}.png`});
    }
    await page.goto('http://127.0.0.1:4173/?demo#office');
    await page.reload();
    await page.locator('.native-office[data-ready="true"]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    for(const theme of ['office','compound']) {
      await page.getByRole('combobox',{name:'Office theme'}).selectOption(theme);
      await page.waitForFunction(theme=>document.querySelector('.native-floor-host').floorScene.art.theme===(theme==='office'?'office':undefined),theme);
      for(const calm of [false,true]) {
        const button=page.getByRole('button',{name:`Calm ${calm?'off':'on'}`,exact:true});
        await page.evaluate(()=>scrollTo(0,0));
        if(await button.count())await button.click();
        await page.waitForTimeout(100);
        await page.screenshot({path:`docs/review/landing-revamp-office-${theme}-${width}${calm?'-calm':''}.png`});
        for(const canvas of await page.locator('.vignette canvas').all()) {
          await canvas.scrollIntoViewIfNeeded();
          await page.waitForFunction(el=>el.dataset.ready==='true',await canvas.elementHandle());
        }
        const metrics=await page.locator('.pitch').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,document:document.documentElement.scrollWidth,viewport:innerWidth}));
        if(metrics.scroll>metrics.width+2||metrics.document>metrics.viewport)throw Error(`Pitch overflow: ${JSON.stringify(metrics)}`);
        await page.locator('.pitch').screenshot({path:`docs/review/landing-revamp-pitch-${theme}-${width}${calm?'-calm':''}.png`});
      }
    }
    console.log(`${width}: reception, office, pitch, both themes and Calm captured`);
    await page.close();
  }
} finally { await browser.close(); }
