import { chromium } from "playwright-core";

const baseUrl = "http://127.0.0.1:4188";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const stage = page.locator('[data-emblem-stage][data-model-state="ready"][data-physics-state="ready"]');
  await stage.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);

  const canvas = page.locator("#emblem-canvas");
  await canvas.screenshot({ path: ".artifacts/closeup-front.png" });

  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.45, { steps: 25 });
    await page.waitForTimeout(500);
    await canvas.screenshot({ path: ".artifacts/closeup-angled.png" });
    await page.mouse.up();
  }
  console.log("Closeups captured on port 4188!");
} finally {
  await browser.close();
}
