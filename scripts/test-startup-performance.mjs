import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";

const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    if (!address || typeof address === "string") {
      reject(new Error("Could not allocate a preview port."));
      listener.close();
      return;
    }
    listener.close(() => resolve(address.port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--outDir", process.env.PERFORMANCE_DIST || "dist", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url),
  stdio: "ignore",
});

let browser;
try {
  const deadline = Date.now() + 20_000;
  while (true) {
    try {
      if ((await fetch(baseUrl)).ok) break;
    } catch {
      if (Date.now() >= deadline) throw new Error("Preview server did not start.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });

  for (const scenario of ["Normal startup", "Prepared during card entrance", "Delayed model startup", "Slow shader compilation", "Late React mounting", "Late project module evaluation", "Late hero module evaluation"]) {
    if (process.env.STARTUP_SCENARIO && scenario !== process.env.STARTUP_SCENARIO) continue;
    // The search controls and whole-row calibration can place card two below
    // a 1000px viewport. Keep both entrance subjects visible in this fixture.
    const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    if (scenario.endsWith("module evaluation") || scenario === "Delayed model startup" || scenario === "Prepared during card entrance") {
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.addInitScript((slowCompilation) => {
      window.entranceProbe = { starts: 0, ends: 0, overlappingDraws: 0, overlappingMounts: 0, gaps: [], intervals: [], longTasks: [], travel: [], interactiveAtRender: null };
      new MutationObserver((records) => {
        if (records.some((record) => record.attributeName === 'data-rendered' && record.target.matches?.('[data-emblem-stage][data-rendered="true"]'))) {
          window.entranceProbe.interactiveAtRender = document.querySelector('#projects-root')?.dataset.interactive;
          window.entranceProbe.renderedAt = performance.now();
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-rendered'] });
      new PerformanceObserver(list => {
        window.entranceProbe.longTasks.push(...list.getEntries().map(entry => ({
          start: entry.startTime, duration: entry.duration,
        })));
      }).observe({ type: "longtask", buffered: true });
      let active = 0;
      window.originalCards = [];
      new MutationObserver(records => {
        // Animation.finished resolves before animationend is dispatched. Check
        // actual timelines so a mount at that boundary is correctly allowed.
        const running = active && [...document.querySelectorAll('.project-card-animate')]
          .some(card => card.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'));
        if (running) window.entranceProbe.overlappingMounts += records.filter(record =>
          record.target instanceof Element && record.target.matches('.project-card-animate'),
        ).length;
      }).observe(document, { childList: true, subtree: true });
      document.addEventListener("animationstart", event => {
        if (event.animationName !== "project-fly-in") return;
        const card = event.target.closest('.project-card-animate');
        active++;
        window.entranceProbe.starts++;
        if (Number(card.dataset.cardIndex) < 2) {
          requestAnimationFrame(() => window.entranceProbe.travel.push({
            card: card.dataset.cardIndex,
            x: new DOMMatrixReadOnly(getComputedStyle(event.target).transform).m41,
          }));
        }
        const stage = document.querySelector('[data-emblem-stage]');
        window.entranceProbe.intervals.push({
          card: card.dataset.cardIndex, start: performance.now(), end: null,
          modelRendered: stage.dataset.rendered, physicsState: stage.dataset.physicsState,
          motionPrimed: stage.dataset.motionPrimed, orientation: stage.dataset.orientation,
          motionStartOrientation: stage.dataset.motionStartOrientation,
        });
        window.originalCards.push(card.querySelector('[data-project]'));
      });
      document.addEventListener("animationend", event => {
        if (event.animationName !== "project-fly-in") return;
        active--;
        window.entranceProbe.ends++;
        const interval = window.entranceProbe.intervals.find(interval => interval.card === (event.target.closest('.project-card-animate').dataset.cardIndex) && interval.end === null);
        interval.end = performance.now();
        interval.endOrientation = document.querySelector('[data-emblem-stage]').dataset.orientation;
      });
      let previous;
      const sample = now => {
        // Exclude work before animationstart: it delays startup, but cannot
        // interrupt a card that has not begun its entrance yet.
        if (active && previous >= window.entranceProbe.intervals[0]?.start) window.entranceProbe.gaps.push(now - previous);
        previous = now;
        if (performance.now() < 5000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      const prototype = WebGL2RenderingContext.prototype;
      for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        const original = prototype[name];
        prototype[name] = function (...args) {
          if (active) window.entranceProbe.overlappingDraws++;
          return original.apply(this, args);
        };
      }
      if (slowCompilation) {
        const original = prototype.getProgramParameter;
        let deadline;
        prototype.getProgramParameter = function (program, parameter) {
          // KHR_parallel_shader_compile: keep compilation pending across the
          // entrance fallback, without blocking the browser's main thread.
          if (parameter === 0x91B1) {
            deadline ??= performance.now() + 650;
            if (performance.now() < deadline) return false;
          }
          return original.call(this, program, parameter);
        };
      }
    }, scenario === "Slow shader compilation");
    if (scenario === "Delayed model startup") {
      await page.route("**/emblem-scene-*.js", async route => {
        await new Promise(resolve => setTimeout(resolve, 650));
        await route.continue();
      });
    }
    if (scenario === "Late React mounting") {
      await page.route("**/projects-island-*.js", async route => {
        await new Promise(resolve => setTimeout(resolve, 900));
        await route.continue();
      });
    }
    if (scenario.endsWith("module evaluation")) {
      const pattern = scenario.startsWith("Late project") ? "**/projects-island-*.js" : "**/emblem-scene-*.js";
      await page.route(pattern, async route => {
        // Delayed module evaluation should finish before the model starts spinning.
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.continue();
      });
    }
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator('[data-emblem-stage][data-rendered="true"]').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-emblem-stage]').dataset.orientation);
    await page.locator('.project-card-animate').first().waitFor();
    // Prove hydration has completed, rather than only inspecting the static tree.
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    await page.waitForFunction(() => ["0", "1"].every((card) =>
      window.entranceProbe.intervals.some((interval) => interval.card === card && interval.end !== null)));
    assert.deepEqual(await page.locator('.project-card-animate').evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => card.dataset.cardReveal)), ['settled', 'settled'],
      "Initially visible cards should finish their entrance.");
    assert.deepEqual((await page.evaluate(() => window.entranceProbe.intervals))
      .filter((interval) => interval.card === "0" || interval.card === "1")
      .map((interval) => interval.card).sort(), ["0", "1"],
      "Each initially visible card should animate once.");
    const orientation = await page.locator('[data-emblem-stage]').getAttribute('data-orientation');
    await page.waitForTimeout(250);
    assert.notEqual(await page.locator('[data-emblem-stage]').getAttribute('data-orientation'), orientation,
      "The emblem did not continue rotating after its first frame.");
    await page.locator('.project-expand-button').first().click();
    await page.getByRole('dialog').waitFor();
    const probe = await page.evaluate(() => window.entranceProbe);
    if (scenario === "Prepared during card entrance") {
      const lastCardEnd = Math.max(...probe.intervals.filter(interval => Number(interval.card) < 2).map(interval => interval.end));
      const revealDelay = probe.renderedAt - lastCardEnd;
      assert.ok(revealDelay >= 0 && revealDelay < 250,
        `The prepared model took ${revealDelay.toFixed(0)} ms to appear after the cards settled.`);
    }
    assert.equal(probe.interactiveAtRender, 'true', "Project hydration interrupted the first model frames.");
    assert.equal(probe.overlappingMounts, 0, "React replaced card contents during an entrance.");
    assert.deepEqual(errors, [], "Startup or hydration produced browser errors.");
    if (scenario === "Normal startup") {
      const earlierStarts = await page.evaluate(() => window.entranceProbe.starts);
      await page.evaluate(() => {
        document.querySelector('.project-card-animate[data-card-index="4"]').classList.add('is-visible');
      });
      await page.waitForFunction((count) => window.entranceProbe.starts > count, earlierStarts);
      await page.waitForFunction((count) => window.entranceProbe.ends > count, earlierStarts);
      const laterEntrance = (await page.evaluate(() => window.entranceProbe)).intervals.at(-1);
      assert.equal(laterEntrance.modelRendered, 'true', 'A later card animated before the model was ready.');
      assert.notEqual(laterEntrance.endOrientation, laterEntrance.orientation,
        "The emblem stopped rotating during a later card entrance.");
    }
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
