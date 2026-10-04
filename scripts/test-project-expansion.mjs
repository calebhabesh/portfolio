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
const baseUrl = process.env.EXPANSION_TEST_URL || `http://127.0.0.1:${port}`;
const server = process.env.EXPANSION_TEST_URL ? null : spawn(process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: "ignore" });
let browser;
try {
  const deadline = Date.now() + 15_000;
  while (true) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (Date.now() >= deadline) throw new Error("Preview did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });
  for (const { width, height } of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 640, colorScheme: width < 640 ? "dark" : "light" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // Isolate card motion from the independent WebGL scene on CI software GPUs.
    await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    const trigger = page.locator('[data-project="doorlink"] .project-expand-button');
    await trigger.focus();
    const result = await page.evaluate(async () => {
      const samples = [];
      document.querySelector('[data-project="doorlink"] .project-expand-button').click();
      const start = performance.now();
      while (performance.now() - start < 500) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        let element = document.querySelector('.project-dialog-summary');
        if (!element) continue;
        let x = 1, y = 1, opacity = 1;
        while (element && !element.classList.contains('project-dialog-overlay')) {
          const style = getComputedStyle(element);
          const matrix = new DOMMatrixReadOnly(style.transform);
          x *= Math.hypot(matrix.m11, matrix.m12);
          y *= Math.hypot(matrix.m21, matrix.m22);
          opacity *= Number(style.opacity);
          element = element.parentElement;
        }
        samples.push({ distortion: Math.abs(x / y - 1), opacity });
      }
      return { samples: samples.length, distortion: Math.max(0, ...samples.filter(s => s.opacity > 0.2).map(s => s.distortion)) };
    });
    console.log(`${width}px: maximum visible text distortion ${(result.distortion * 100).toFixed(1)}% (${result.samples} frames)`);
    assert.ok(result.samples > 2, "The browser must sample the actual expansion.");
    assert.ok(result.distortion < 0.03, "Expanding a project must not stretch its readable text.");
    const closing = await page.evaluate(async () => {
      document.querySelector('.project-dialog-close').click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        stillClosing: Boolean(document.querySelector('[role="dialog"]')),
        sourceOpacity: getComputedStyle(document.querySelector('[data-project="doorlink"]').closest('.project-comet-card')).opacity,
        scrollLocked: document.documentElement.style.overflow === "hidden",
      };
    });
    assert.equal(closing.stillClosing, true, "The probe must observe the closing transition.");
    assert.equal(closing.sourceOpacity, "0", "The source must stay hidden until the collapsing panel lands.");
    assert.equal(closing.scrollLocked, true, "Background scrolling must stay locked throughout the exit.");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.ok(await trigger.evaluate(element => element === document.activeElement), "Closing must restore trigger focus.");

    // Close during the opening flight. Freeze its real browser animation at
    // an intermediate frame, then verify the reversal starts at that frame.
    const reversal = await page.evaluate(async () => {
      document.querySelector('[data-project="doorlink"] .project-expand-button').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const paper = document.querySelector('.project-dialog-surface');
      for (const animation of document.querySelector('.project-dialog-overlay').getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 80;
      }
      const before = paper.getBoundingClientRect().toJSON();
      document.querySelector('.project-dialog-close').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      for (const animation of paper.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
      const after = paper.getBoundingClientRect().toJSON();
      for (const animation of paper.getAnimations()) animation.play();
      return Math.max(...["x", "y", "width", "height"].map(key => Math.abs(before[key] - after[key])));
    });
    assert.ok(reversal < 1, `Early close jumped ${reversal.toFixed(1)}px instead of reversing the current frame.`);
    await page.getByRole("dialog").waitFor({ state: "detached" });

    // Resize while in flight, as when a phone rotates or browser chrome moves.
    await trigger.evaluate(element => element.click());
    await page.getByRole("dialog").waitFor();
    await page.setViewportSize({ width: height, height: width });
    await page.waitForFunction(() => {
      const rect = document.querySelector('[role="dialog"]').getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight + 1;
    });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await trigger.evaluate(element => element.click());
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.locator('.project-dialog-surface').evaluate(element => getComputedStyle(element).transform), "none",
      "Reduced motion must show the final panel without a scale animation.");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await trigger.evaluate(element => element.click());
    await page.getByRole("dialog").waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.project-dialog-content')).opacity === "1");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.deepEqual(errors.filter(error => !/emblem|Failed to fetch dynamically imported module/.test(error)), []);
    console.log(`${width}px: exit handoff, interrupted reversal, rotation and reduced motion passed`);
    await page.close();
  }
} finally {
  await browser?.close();
  server?.kill();
}
