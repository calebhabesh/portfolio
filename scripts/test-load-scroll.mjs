import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";

const port = await new Promise(resolve => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = process.env.PORTFOLIO_TEST_URL || `http://127.0.0.1:${port}`;
const server = process.env.PORTFOLIO_TEST_URL ? undefined : spawn(process.execPath, [
  "./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
], { cwd: new URL("../", import.meta.url), stdio: "ignore" });
let browser;

async function settleStartup(page) {
  await page.locator('#projects-root[data-interactive="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => ![...document.querySelectorAll(".site-header, .hero-copy, .section-header")]
    .some(element => element.getAnimations().some(animation => animation.playState === "running")));
  await page.evaluate(() => new Promise(resolve => {
    let remaining = 5;
    const frame = () => --remaining ? requestAnimationFrame(frame) : resolve();
    requestAnimationFrame(frame);
  }));
}

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme });
      // The WebGL scene is independent of document scrolling.
      await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
      await page.addInitScript(() => {
        window.startupScrollPositions = [];
        window.addEventListener("scroll", () => window.startupScrollPositions.push(scrollY), { passive: true });
      });
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      for (let reload = 0; reload <= 2; reload++) {
        if (reload) await page.reload({ waitUntil: "networkidle" });
        await settleStartup(page);
        const position = await page.evaluate(() => ({ y: scrollY, events: window.startupScrollPositions }));
        assert.equal(position.y, 0, `Page must stay at the top on ${reload ? `reload ${reload}` : "first load"} (${theme}, ${width}px).`);
        assert.ok(position.events.every(y => y === 0), "Startup must not cause a temporary scroll jump.");
      }
      // Keep the browser's useful restoration when a reader reloads farther down.
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
      const savedPosition = await page.evaluate(() => scrollY);
      await page.reload({ waitUntil: "networkidle" });
      await settleStartup(page);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - savedPosition) <= 1,
        `Reload must preserve an intentional reading position (${theme}, ${width}px).`);
      await page.close();
    }
  }
  console.log("Load/reload scrolling passed in both themes at three widths, including preserved reading positions.");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
