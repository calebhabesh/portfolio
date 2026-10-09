import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import { ROOT } from "./build-cache.mjs";

const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: ROOT, stdio: "ignore",
});
let serverError;
server.on("error", error => { serverError = error; });
let browser;

async function waitForResults(page, expected) {
  await page.waitForFunction(ids => {
    const slots = [...document.querySelectorAll('.project-card-animate[data-search-match="true"]')];
    const actual = slots.map(slot => slot.querySelector("[data-project]")?.dataset.project);
    return JSON.stringify(actual) === JSON.stringify(ids) && slots.every(slot =>
      Number(getComputedStyle(slot.querySelector(".project-slot-content")).opacity) >= 0.999);
  }, expected);
}

try {
  const deadline = Date.now() + 15_000;
  while (true) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error("Preview server exited before becoming ready.");
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (Date.now() >= deadline) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });
  for (const scenario of [
    { width: 1440, colorScheme: "light", reducedMotion: "no-preference" },
    { width: 390, colorScheme: "dark", reducedMotion: "reduce" },
  ]) {
    const context = await browser.newContext({
      colorScheme: scenario.colorScheme, reducedMotion: scenario.reducedMotion,
      viewport: { width: scenario.width, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => {
      if (response.url().startsWith(baseUrl) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    try {
      assert.equal((await page.goto(baseUrl, { waitUntil: "domcontentloaded" })).status(), 200);
      assert.match(await page.title(), /Caleb Habesh/);
      await page.locator('#projects-root[data-interactive="true"]').waitFor();
      await page.locator('[data-emblem-stage][data-model-state="ready"][data-physics-state="ready"][data-rendered="true"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.locator("#hero-title").isVisible(), "Hero heading is missing.");
      assert.ok(await page.locator("#emblem-canvas").isVisible(), "Emblem canvas is missing.");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflows horizontally.");

      const allIds = ["doorlink", "linewatch", "orbit", "courtlens", "medical-imaging", "systemc-noc", "fpga-pong", "portfolio-site"];
      const search = page.getByRole("searchbox", { name: "Search technologies" });
      await search.fill("Java");
      await waitForResults(page, ["doorlink", "linewatch", "portfolio-site"]);
      await search.fill("impossible-stack");
      await page.locator(".project-search-empty").waitFor();
      await waitForResults(page, []);
      await search.press("Escape");
      assert.equal(await search.inputValue(), "");
      await waitForResults(page, allIds);

      for (const [id, query] of [["systemc-noc", "SystemC"], ["fpga-pong", "VHDL"]]) {
        await search.fill(query);
        await waitForResults(page, [id]);
        await page.locator(`[data-project="${id}"] .project-expand-button`).click();
        const courseDialog = page.getByRole("dialog");
        await courseDialog.waitFor();
        assert.match(await courseDialog.innerText(), /2026/);
        assert.equal(await courseDialog.locator(`a[href="https://github.com/calebhabesh/${id}"]`).count(), 1);
        const courseImage = courseDialog.locator(".project-gallery-stage img");
        await courseImage.waitFor();
        await courseImage.evaluate(img => img.decode());
        assert.ok(await courseImage.evaluate(img => img.naturalWidth > 0));
        if (id === "fpga-pong") {
          assert.match(await courseDialog.innerText(), /2024 board demo/);
          await courseDialog.getByRole("button", { name: "Next image", exact: true }).click();
          assert.match(await courseImage.getAttribute("src"), /rtl-frame-2026\.png$/);
          await courseImage.evaluate(img => img.decode());
          assert.match(await courseDialog.innerText(), /2026 simulation/);
        }
        await page.keyboard.press("Escape");
        await courseDialog.waitFor({ state: "detached" });
      }
      await search.fill("");
      await waitForResults(page, allIds);

      const expand = page.locator('[data-project="doorlink"] .project-expand-button');
      await expand.focus();
      await expand.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /Custom Hardware/);
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), "Dialog should receive focus.");
      await page.keyboard.press("Shift+Tab");
      assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), "Dialog should retain keyboard focus.");
      const gallery = dialog.locator(".project-gallery-stage img");
      const firstImage = await gallery.getAttribute("src");
      await dialog.getByRole("button", { name: "Next image", exact: true }).click();
      await page.waitForFunction(first => document.querySelector(".project-gallery-stage img")?.getAttribute("src") !== first, firstImage);
      await page.waitForFunction(() => {
        const image = document.querySelector(".project-gallery-stage img");
        return image?.complete && image.naturalWidth > 0;
      });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert.ok(await expand.evaluate(element => element === document.activeElement), "Closing should restore focus.");

      const originalTheme = await page.locator("html").getAttribute("data-theme");
      assert.equal(originalTheme, scenario.colorScheme);
      await page.locator("[data-theme-toggle]").click();
      assert.notEqual(await page.locator("html").getAttribute("data-theme"), originalTheme);
      await page.locator("[data-theme-toggle]").click();
      assert.equal(await page.locator("html").getAttribute("data-theme"), originalTheme);
      if (scenario.width === 1440) {
        const accessibility = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(accessibility.violations.map(({ id, impact }) => ({ id, impact })), [], "Accessibility violations.");
      }
      assert.deepEqual(errors, [], "Browser errors or failed local resources.");
      console.log(`Quick browser checks passed at ${scenario.width}px (${scenario.colorScheme}, ${scenario.reducedMotion}).`);
    } catch (error) {
      await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
      await page.screenshot({ path: new URL(`../.artifacts/quick-failure-${scenario.width}.png`, import.meta.url).pathname }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
