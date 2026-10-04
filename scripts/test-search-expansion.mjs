import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

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

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const { width, reducedMotion } of [
    { width: 1440, reducedMotion: "no-preference" },
    { width: 390, reducedMotion: "no-preference" },
    { width: 320, reducedMotion: "reduce" },
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, colorScheme: width === 390 ? "dark" : "light" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    const search = page.getByRole("searchbox", { name: "Search technologies" });
    for (const [query, id] of [["", "linewatch"], ["Mos", "doorlink"], ["OCI", "linewatch"], ["Go", "file-sync"], ["Java", "doorlink"], ["Pyhton", "courtload"], ["React, PostgreSQL", "doorlink"]]) {
      await search.fill(query);
      await page.waitForFunction(id => {
        const card = document.querySelector(`[data-project="${id}"]`);
        const slot = card?.closest(".project-card-animate");
        return slot?.dataset.resultId === id && getComputedStyle(card.closest(".project-slot-content")).opacity === "1";
      }, id);
      const card = page.locator(`[data-project="${id}"]`);
      await card.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.waitForFunction(id => document.querySelector(`[data-project="${id}"]`).closest(".project-card-animate").dataset.cardReveal === "settled", id);
      await page.mouse.move(0, 0);
      // Record actual rendered geometry, rather than Motion's configuration.
      const opening = await page.evaluate(async id => {
        const card = document.querySelector(`[data-project="${id}"]`);
        const source = card.getBoundingClientRect().toJSON();
        card.querySelector(".project-expand-button").focus({ preventScroll: true });
        card.querySelector(".project-expand-button").click();
        const samples = [];
        const start = performance.now();
        while (performance.now() - start < 700) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) samples.push({ t: performance.now() - start, ...dialog.querySelector(".project-dialog-surface").getBoundingClientRect().toJSON() });
        }
        return { source, samples };
      }, id);
      const final = opening.samples.at(-1);
      assert.ok(final, `No dialog opened for ${query || "default"} at ${width}px.`);
      const noteMatches = await page.getByRole("dialog").locator(".project-evidence mark").allTextContents();
      if (!query) assert.deepEqual(noteMatches, [], "Unfiltered notes must not have search emphasis.");
      if (query === "Mos") assert.deepEqual(noteMatches, ["Mos"]);
      if (query === "OCI") assert.deepEqual(noteMatches, ["Oracle Cloud Infrastructure", "OCI", "OCI"]);
      if (query === "Pyhton") assert.deepEqual(noteMatches, ["Python"]);
      if (query === "React, PostgreSQL") assert.deepEqual(noteMatches, ["PostgreSQL"]);
      if (query === "Go") assert.equal(await page.getByRole("dialog").locator(".project-dialog-summary mark").innerText(), "Go");
      for (const mark of await page.getByRole("dialog").locator(".project-evidence mark").all()) {
        assert.deepEqual(await mark.evaluate(element => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, weight: style.fontWeight };
        }), { background: "rgba(0, 0, 0, 0)", weight: "700" });
      }
      if (query) {
        const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withRules(["color-contrast"]).analyze();
        assert.deepEqual(accessibility.violations, [], "Highlighted project notes must have accessible contrast.");
      }
      if (query === "Mos") {
        await page.getByRole("dialog").locator(".project-evidence mark").scrollIntoViewIfNeeded();
        await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
        await page.screenshot({ path: `.artifacts/search-notes-${width}.png` });
      }
      const dimension = Math.abs(opening.source.width - final.width) > 80 ? "width" : "height";
      const distance = Math.abs(opening.source[dimension] - final[dimension]);
      if (reducedMotion !== "reduce") {
        assert.ok(distance > 30, "The morph probe needs distinct compact and expanded dimensions.");
        assert.ok(opening.samples.some(sample => sample.t < 100 && Math.abs(sample[dimension] - opening.source[dimension]) < distance * 0.5),
          `The ${query || "default"} result must expand from its card at ${width}px.`);
      }
      assert.equal(await card.evaluate(element => getComputedStyle(element.closest(".project-comet-card")).opacity), "0");
      assert.equal(await card.evaluate(element => element.inert), true);
      const closing = await page.evaluate(async () => {
        document.querySelector(".project-dialog-close").click();
        const samples = [];
        const start = performance.now();
        while (performance.now() - start < 500) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) samples.push(dialog.querySelector(".project-dialog-surface").getBoundingClientRect().toJSON());
        }
        return samples;
      });
      if (reducedMotion !== "reduce") {
        assert.ok(closing.some(sample => Math.abs(sample[dimension] - opening.source[dimension]) < distance * 0.75),
          `The ${query || "default"} result must collapse back to its card at ${width}px.`);
      }
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(await card.evaluate(element => getComputedStyle(element.closest(".project-comet-card")).opacity), "1");
      assert.equal(await card.evaluate(element => element.inert), false);
      assert.equal(await card.locator(".project-expand-button").evaluate(button => button === document.activeElement), true);
      assert.equal(await search.inputValue(), query, "Closing details must preserve the search.");
    }
    assert.deepEqual(errors.filter(error => !/emblem|Failed to fetch dynamically imported module/.test(error)), []);
    await context.close();
    console.log(`Search expansion passed at ${width}px (${reducedMotion}).`);
  }
} finally {
  await browser?.close();
  server.kill();
}
