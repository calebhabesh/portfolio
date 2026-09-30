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
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url), stdio: "ignore",
});
let browser;

const hasColor = page => page.locator('.grid-pointer-trail').evaluate(canvas => {
  if (!canvas.width || !canvas.height) return false;
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    .some((value, index) => index % 4 === 3 && value > 0);
});
const background = page => page.evaluate(() => {
  const style = getComputedStyle(document.body);
  return [style.backgroundColor, style.backgroundImage, style.backgroundSize, style.backgroundPosition];
});
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, colorScheme: theme, deviceScaleFactor: theme === "dark" ? 2 : 1 });
    await page.route("**/emblem-scene-*.js", route => route.abort());
    await page.addInitScript(() => {
      window.trailPaints = [];
      window.addEventListener('pointermove', event => {
        window.lastTrailPointer = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType };
      });
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (this.canvas.classList.contains('grid-pointer-trail')) window.trailPaints.push({ x, y, width, height });
        return fill.call(this, x, y, width, height);
      };
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    await page.locator('.grid-pointer-trail').waitFor({ state: "attached" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await settle(page);
      const grid = await page.evaluate(() => ({
        unit: parseFloat(document.documentElement.style.getPropertyValue('--grid-unit')),
        origin: parseFloat(document.documentElement.style.getPropertyValue('--grid-origin-y')) - scrollY,
        left: document.querySelector('.page-shell').getBoundingClientRect().left,
      }));
      const point = {
        x: grid.left + (Math.floor((width * 0.62 - grid.left) / grid.unit) + 0.5) * grid.unit,
        y: grid.origin - grid.unit / 2,
      };
      const originalBackground = await background(page);
      const clip = { x: Math.floor(point.x), y: Math.floor(point.y), width: 2, height: 2 };
      const idlePixel = await page.screenshot({ clip });
      await page.evaluate(() => { window.trailPaints = []; });
      await page.mouse.move(point.x - grid.unit * 2, point.y);
      await settle(page);
      await page.mouse.move(point.x, point.y);
      await settle(page);
      assert.equal(await hasColor(page), true, "Pointer movement must color the crossed grid cells.");
      const fills = await page.evaluate(() => window.trailPaints);
      assert.ok(fills.length > 0);
      const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.75, `${actual} does not meet grid coordinate ${expected}`);
      for (const fill of fills) {
        near(fill.width, grid.unit - 1);
        near(fill.height, grid.unit - 1);
        near(fill.x - 0.5, grid.left + Math.round((fill.x - 0.5 - grid.left) / grid.unit) * grid.unit);
        near(fill.y - 0.5, grid.origin + Math.round((fill.y - 0.5 - grid.origin) / grid.unit) * grid.unit);
      }
      assert.equal((await page.screenshot({ clip })).equals(idlePixel), false,
        "The transparent trail layer must actually paint above the page background.");
      assert.deepEqual(await background(page), originalBackground, "The existing grid and gradients must stay unchanged.");
      await page.waitForTimeout(750);
      assert.equal(await hasColor(page), false, "The cell under a stationary cursor must clear.");
      const paintCount = await page.evaluate(() => window.trailPaints.length);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.trailPaints.length), paintCount, "Painting must stop when the trail expires.");
      await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', window.lastTrailPointer)));
      await settle(page);
      assert.equal(await hasColor(page), false, "Repeated stationary pointer events must not reactivate the trail.");
      assert.ok((await page.screenshot({ clip })).equals(idlePixel), "Idle background pixels must return to their original appearance.");
    }

    await page.setViewportSize({ width: 1440, height: 950 });
    await settle(page);
    const sweep = await page.locator('.project-frame').first().boundingBox();
    const sweepUnit = await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--grid-unit')));
    await page.evaluate(() => { window.trailPaints = []; });
    await page.mouse.move(sweep.x - sweepUnit * 1.5, sweep.y + sweepUnit * 1.5);
    await settle(page);
    await page.mouse.move(sweep.x + sweep.width + sweepUnit * 1.5, sweep.y + sweepUnit * 1.5);
    await settle(page);
    const sweptFills = await page.evaluate(() => window.trailPaints);
    assert.ok(sweptFills.length > 0, "Fast sweeps should still highlight open cells.");
    assert.ok(sweptFills.every(fill => fill.x + fill.width <= sweep.x + 0.75
      || fill.x >= sweep.x + sweep.width - 0.75
      || fill.y + fill.height <= sweep.y + 0.75 || fill.y >= sweep.y + sweep.height - 0.75),
      "Fast pointer sweeps must skip the grid cells occupied by a card.");

    await page.mouse.move(5, 20);
    await settle(page);
    assert.equal(await hasColor(page), true);
    await page.locator('.project-box-summary').first().hover();
    await settle(page);
    assert.equal(await hasColor(page), false, "Entering card text must immediately clear the trail.");
    await page.locator('.project-expand-button').first().hover();
    await settle(page);
    assert.equal(await hasColor(page), false, "Card controls must not activate the grid trail.");
    const frameBounds = await page.locator('.project-frame').first().boundingBox();
    await page.mouse.move(frameBounds.x + 1, frameBounds.y + 2);
    await settle(page);
    assert.equal(await hasColor(page), false, "The frame padding must also suppress the grid trail.");
    await page.mouse.move(5, 40);
    await settle(page);
    assert.equal(await hasColor(page), true, "The trail should resume in open areas after leaving a card.");

    await page.locator('.project-expand-button').first().click();
    await page.getByRole('dialog').waitFor();
    await page.mouse.move(30, 150);
    await settle(page);
    assert.equal(await hasColor(page), false, "Moving over an expanded project must not paint the background.");
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });

    await page.mouse.move(80, 150);
    await settle(page);
    assert.equal(await hasColor(page), true);
    await page.evaluate(() => window.scrollTo(0, 100));
    await settle(page);
    assert.equal(await hasColor(page), false, "Scrolling must clear stale cells instead of detaching them from the grid.");
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(100, 170);
    await settle(page);
    assert.equal(await hasColor(page), false, "Reduced motion must disable the decorative trail.");
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await settle(page);
    await page.mouse.move(130, 170);
    await settle(page);
    assert.equal(await hasColor(page), true, "The trail must resume when reduced motion is switched off.");
    await page.close();
  }
  const touchPage = await browser.newPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  await touchPage.route("**/emblem-scene-*.js", route => route.abort());
  await touchPage.goto(baseUrl, { waitUntil: "networkidle" });
  await touchPage.locator('.grid-pointer-trail').waitFor({ state: "attached" });
  await touchPage.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 100, pointerType: 'touch' })));
  await settle(touchPage);
  assert.equal(await hasColor(touchPage), false, "Touch scrolling must not activate the pointer trail.");
  await touchPage.close();
  console.log("Grid trail passed: coordinates, visible fills, idle fade, unchanged background, dialogs, scroll, reduced motion, and touch.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
