import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "0"], {
  cwd: new URL("../", import.meta.url),
  stdio: ["ignore", "pipe", "pipe"],
});

let browser;
try {
  const baseUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Vite did not start.")), 20_000);
    server.stdout.on("data", chunk => {
      output += chunk;
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        clearTimeout(timeout);
        resolve(url);
      }
    });
    server.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited with code ${code}.`));
    });
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const guide = page.locator(".emblem-interaction-guide");
    const stage = page.locator("[data-emblem-stage]");
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));

    async function assertGuideShown(label) {
      await page.locator('[data-emblem-stage][data-rendered="true"]').waitFor({ timeout: 30_000 });
      assert.notEqual(await stage.getAttribute("data-guide-dismissed"), "true", label);
      await guide.waitFor({ state: "visible", timeout: 5_000 });
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".emblem-interaction-guide")).opacity) > 0.9);
    }

    await page.goto(baseUrl);
    await assertGuideShown("The finger guide should appear on the first load.");
    for (let reload = 1; reload <= 2; reload += 1) {
      await page.locator("#emblem-canvas").click();
      assert.equal(await stage.getAttribute("data-guide-dismissed"), "true", "Interacting with the model should dismiss the guide.");
      await guide.waitFor({ state: "hidden" });
      await page.reload();
      await assertGuideShown(`The finger guide should reappear after reload ${reload}.`);
    }

    // Returning visitors may still have the dismissal flag from the old behavior.
    await page.evaluate(() => sessionStorage.setItem("caleb-emblem-guide-dismissed", "true"));
    await page.reload();
    await assertGuideShown("A saved dismissal from an earlier visit should not hide the guide.");
    assert.deepEqual(errors, [], "The guide lifecycle should not cause browser errors.");
    console.log(`Finger guide passed at ${viewport.width}px: initial load, dismissal, repeated reloads, and existing saved dismissal.`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
