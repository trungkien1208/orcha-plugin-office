// Landing check. Build and start the preview first:
//   bun scripts/build-landing.ts && bun scripts/preview-landing.ts
// then: node scripts/check-landing.mjs [--shots]   (--shots saves docs/review/landing-*.png)
import { chromium } from "@playwright/test";

const BASE = process.env.EASY_JOB_LANDING_URL ?? "http://127.0.0.1:4173/";
const shots = process.argv.includes("--shots");
const sizes = [
  [390, 844],
  [1024, 700],
  [1440, 900],
  [2560, 1440],
];
const errors = [];
const fail = (message) => {
  throw new Error(message);
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  for (const [width, height] of sizes) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
    page.on("response", (r) => r.status() >= 400 && errors.push(`${width}: ${r.status()} ${r.url()}`));
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (url.protocol.startsWith("http") && url.host !== new URL(BASE).host) errors.push(`outbound ${url.href}`);
      if (url.pathname.startsWith("/api/")) errors.push("landing must not call the bridge");
    });

    // Title screen: parade drawn, Press start reachable, page behind it inert.
    await page.goto(BASE);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelectorAll('.walker[data-ready="true"]').length >= 12);
    if (!(await page.locator(".manual").evaluate((el) => el.inert))) fail("manual is not inert behind the title screen");
    const start = await page.getByRole("button", { name: "Press start" }).boundingBox();
    if (!start || start.y + start.height > height) fail(`Press start is off screen at ${width}`);
    if (shots) {
      await page.waitForTimeout(2500); // let the letters land and the tagline type out
      await page.screenshot({ path: `docs/review/landing-intro-${width}.png` });
    }

    // Any key leaves it.
    await page.keyboard.press("Space");
    await page.locator(".intro").waitFor({ state: "detached" });
    if ((await page.evaluate(() => location.hash)) !== "#play") fail("start did not set #play");

    // Manual: no sideways scroll, the product demo drawn, interactions work.
    await page.waitForFunction(() => {
      const benches = [...document.querySelectorAll(".ej-demo canvas")];
      return benches.length > 0 && benches.every((c) => c.dataset.ready === "true");
    });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      tall: document.documentElement.scrollHeight > innerHeight + 1,
      // The demo is an illustration scaled by its stage; page copy is what has to stay readable.
      small: [...document.querySelectorAll(".manual *")].filter(
        (e) =>
          e.offsetParent &&
          !e.closest(".ss-stage") &&
          [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
          Number.parseFloat(getComputedStyle(e).fontSize) < 12,
      ).length,
    }));
    if (layout.overflow) fail(`horizontal overflow at ${width}`);
    // Desktop sizes keep the manual on one screen.
    if (width >= 1000 && height >= 680 && layout.tall) fail(`manual scrolls at ${width}×${height}`);
    if (layout.small) fail(`${layout.small} text elements under 12px at ${width}`);

    // The demo plays its story: a raised hand, the click, the answer, the agent back at work.
    await page.locator(".ej-pill[data-state='blocked']").first().waitFor({ state: "attached", timeout: 8000 });
    await page.locator(".ej-reply[data-show]").waitFor({ state: "attached", timeout: 12000 });
    await page.getByRole("button", { name: "Copy installation commands" }).click();
    await page
      .waitForFunction(() => document.querySelector('[data-testid="credits"]')?.textContent === "01", null, { timeout: 5000 })
      .catch(() => fail("copy did not add a credit"));
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (!copied.includes("orcha office install") || copied.includes("#")) fail("clipboard does not hold the install commands");

    if (shots) await page.screenshot({ path: `docs/review/landing-manual-${width}.png`, fullPage: true });

    // System "reduce motion": everything stills, title screen included.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".landing")?.dataset.calm === "true");
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll(".landing *")].filter((e) => getComputedStyle(e).animationName !== "none").length,
    );
    if (moving) fail(`${moving} elements still animate with reduced motion`);
    // Reduced motion shows the demo's poster: the question already answered.
    await page.reload();
    await page.locator(".ej-reply[data-show]").waitFor({ state: "attached", timeout: 5000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // Back to the title screen, and #play skips it on reload.
    await page.getByRole("button", { name: "Back to the title screen" }).first().click();
    await page.locator(".intro").waitFor();
    await page.goto(`${BASE}#play`);
    await page.reload();
    if (await page.locator(".intro").count()) fail("#play did not skip the title screen");

    console.log(`${width}×${height}: title, start, demo story, copy, reduced motion + poster, return passed`);
    await page.close();
  }
  if (errors.length) fail(errors.join("\n"));
  console.log("No overflow, missing assets, browser errors, outbound or bridge requests.");
} finally {
  await browser.close();
}
