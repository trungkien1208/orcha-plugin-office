// Build and start `bun scripts/preview-landing.ts` before running this visual/interaction check.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const errors = [];
const sizes = [[2560,1440],[2560,1283],[2048,1152],[2048,1029],[1920,1080],[1440,900],[1024,700],[390,844]];
try {
  for (const dpr of [1,2]) {
    const context = await browser.newContext({ deviceScaleFactor:dpr, permissions:["clipboard-read","clipboard-write"] });
    context.setDefaultTimeout(45000);
    for (const [width,height] of sizes) {
      const page = await context.newPage();
      await page.setViewportSize({width,height});
      page.on("pageerror",error=>errors.push(error.message));
      page.on("response",response=>{ if(response.status()>=400)errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
      page.on("request",request=>{ if(new URL(request.url()).pathname.startsWith("/api/"))errors.push("Landing must not call the bridge API"); });
      await page.goto("http://127.0.0.1:4173/?demo");
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.querySelector(".door-illustration")?.dataset.rendered==="true");
      if(!await page.locator(".workplace").evaluate(element=>element.inert))throw new Error("Main view is not inert during the intro");
      const brand=page.locator(".entry-header .brand-logo");
      await brand.evaluate(image=>image.decode());
      const entry = await page.getByRole("button",{name:"Clock in",exact:true}).boundingBox();
      if(!entry||entry.x<0||entry.y<0||entry.x+entry.width>width||entry.y+entry.height>height)throw new Error(`Clipped intro CTA at ${width}`);
      if(dpr===1)await page.screenshot({path:`docs/review/reception-intro-${width}.png`});
      await page.getByRole("button",{name:"Clock in",exact:true}).click();
      await page.locator(".entry-screen").waitFor({state:"detached"});
      await page.locator('.native-office[data-ready="true"]').waitFor();
      const native=await page.locator('.native-floor-host').evaluate(element=>{const scene=element.floorScene;return {workers:scene.workers.size,seats:scene.room.chairs.size,missing:[...scene.workers.values()].filter(w=>!w.sprite.texture.key.startsWith('character:')).length,wallSides:new Set(scene.children.list.map(item=>item.getData("wallSide")).filter(Boolean)).size,unseated:[...scene.workers.values()].filter(w=>w.sprite.x!==w.desk.x||w.sprite.y!==w.desk.y).length};});
      if(native.workers!==12||native.seats!==12||native.missing||native.unseated||native.wallSides!==4)throw Error(`Native Floor setup failed: ${JSON.stringify(native)}`);
      for(const theme of ["office","compound"]) {
        await page.getByRole("combobox",{name:"Office theme"}).selectOption(theme);
        await page.waitForFunction(theme=>document.querySelector(".native-floor-host").floorScene.art.theme===(theme==="office"?"office":undefined),theme);
        const metrics = await page.evaluate(()=>{
          const room=document.querySelector(".room-scene").getBoundingClientRect();
          const bodySize=parseFloat(getComputedStyle(document.querySelector(".note-message")).fontSize);
          const actionSize=parseFloat(getComputedStyle(document.querySelector(".note-actions button")).fontSize);
          const navSize=parseFloat(getComputedStyle(document.querySelector(".office-header nav")).fontSize);
          const logo=document.querySelector(".office-header .brand-logo");
          const noteElement=document.querySelector(".note-panel");
          const note=noteElement.getBoundingClientRect();
          const verticalClip=noteElement.scrollHeight>noteElement.clientHeight+2;
          const roster=noteElement.querySelector(".bench-roster");
          const rosterOverlap=roster&&getComputedStyle(roster).display!=="none"&&roster.querySelector("button:last-child").getBoundingClientRect().bottom>noteElement.querySelector(".sample-copy").getBoundingClientRect().top;
          const noteOutside=note.top<0||note.bottom>innerHeight||note.left<0||note.right>innerWidth;
          const clipped=[...document.querySelectorAll(".note-message,.note-actions button,.office-header,.file-body,.pass-bottom")].filter(element=>element.offsetParent!==null&&element.scrollWidth>element.clientWidth+2).length;
          const overflow=document.documentElement.scrollWidth>innerWidth||document.querySelector(".workplace").getBoundingClientRect().height>innerHeight+1;
          const outside=0;
          return {overflow,outside,noteOutside,verticalClip,rosterOverlap,bodySize,actionSize,navSize,clipped,logoLoaded:logo.complete&&logo.naturalWidth>0,width:room.width,height:room.height,right:room.right,bottom:room.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight};
        });
        if(metrics.overflow||metrics.outside||metrics.noteOutside||metrics.verticalClip||metrics.rosterOverlap||metrics.clipped||!metrics.logoLoaded||metrics.width<150||metrics.width/metrics.height>3||metrics.right>width||metrics.bottom>height)throw new Error(`Bad scene at ${width} ${theme} DPR${dpr}: ${JSON.stringify(metrics)}`);
        if(width>=2200&&(metrics.bodySize<20||metrics.actionSize<16||metrics.navSize<15))throw new Error(`27-inch type is too small: ${JSON.stringify(metrics)}`);
        if(width>=1700&&width<2200&&metrics.bodySize<18)throw new Error(`Desktop body type is too small: ${JSON.stringify(metrics)}`);
        const pitchMetrics = await page.locator(".pitch").evaluate(element => ({
          overflow: element.scrollWidth > element.clientWidth + 2,
          outside: [...element.querySelectorAll(".office-paper,.notice-board,.time-card,.office-rules")].some(node => {const r=node.getBoundingClientRect();return r.left < -1 || r.right > innerWidth + 1;}),
          scenes: element.querySelectorAll(".vignette").length,
          columns: getComputedStyle(element.querySelector(".board-notes")).gridTemplateColumns.split(" ").length,
          paperColumns: getComputedStyle(element.querySelector(".paper-columns")).gridTemplateColumns.split(" ").length,
        }));
        if(pitchMetrics.overflow || pitchMetrics.outside || pitchMetrics.scenes !== 5 || (width <= 700 && (pitchMetrics.columns !== 1 || pitchMetrics.paperColumns !== 1)))throw new Error(`Pitch overflow/scenes at ${width} ${theme}: ${JSON.stringify(pitchMetrics)}`);
        if(dpr===1)await page.screenshot({path:`docs/review/boss-${theme}-${width}.png`});
      }
      await page.getByRole("button",{name:"Select Pixel, Needs you",exact:true}).focus();
      await page.getByRole("button",{name:"Select Pixel, Needs you",exact:true}).press("Enter");
      await page.getByRole("button",{name:"Yes, run the tests",exact:true}).click();
      await page.locator(".state-stamp.working").waitFor();
      await page.getByRole("button",{name:"Select Root, Done",exact:true}).focus();
      await page.getByRole("button",{name:"Select Root, Done",exact:true}).press("Enter");
      await page.getByRole("button",{name:"Looks good. Mark Seen",exact:true}).click();
      await page.locator(".state-stamp.idle").waitFor();
      const room = page.getByRole("application");
      await room.focus();
      await room.evaluate(element=>{const scene=element.floorScene;scene.actions.stop();scene.boss.setPosition(320,336);});
      await page.keyboard.down("ArrowLeft");await page.waitForTimeout(180);await page.keyboard.up("ArrowLeft");
      const bossX=await room.evaluate(element=>element.floorScene.boss.x);
      if(bossX>=320)throw new Error("Native Boss keyboard movement failed");
      await page.locator(".office-heading").getByRole("button",{name:"Make it your office",exact:false}).click();
      await page.getByRole("dialog").waitFor();
      await page.locator(".install-dialog").getByRole("button",{name:"Copy installation commands"}).click();
      if(await page.evaluate(()=>navigator.clipboard.readText())!=="bun install\nbun run install-local\neasy-job")throw new Error("Installation clipboard mismatch");
      await page.keyboard.press("Escape");
      if(await page.getByRole("dialog").isVisible())throw new Error("Modal Escape failed");
      await page.getByRole("button",{name:"Return to reception"}).click();
      await page.getByRole("button",{name:"Clock in",exact:true}).waitFor();
      await page.getByRole("button",{name:"Clock in",exact:true}).press("Enter");
      await page.locator(".entry-screen").waitFor({state:"detached"});
      await page.close();
      console.log(`${width}x${height} DPR${dpr}: intro, main, logo, readable type, 12 native seats, four walls, both themes, Answer/Seen, movement and copy passed`);
    }
    await context.close();
  }
  if(errors.length)throw new Error(JSON.stringify(errors));
  console.log("No document overflow, missing assets, browser errors or bridge requests.");
} finally {
  await browser.close();
}
