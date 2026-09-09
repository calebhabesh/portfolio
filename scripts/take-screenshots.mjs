import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:4174";
const artifactDir = new URL("../.artifacts/", import.meta.url);

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") {
      console.error("[CONSOLE ERROR]:", m.text());
      errors.push(m.text());
    }
  });
  page.on("pageerror", (e) => {
    console.error("[PAGE ERROR]:", e.message);
    errors.push(e.message);
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const emblemStage = page.locator('[data-emblem-stage][data-model-state="ready"][data-physics-state="ready"]');
  await emblemStage.waitFor({ timeout: 20000 });

  await page.waitForTimeout(1000);

  // 1. Front view
  await emblemStage.screenshot({
    path: new URL("relic-emblem-front.png", artifactDir).pathname,
  });
  console.log("Captured front screenshot");

  const emblemCanvas = page.locator("#emblem-canvas");
  const box = await emblemCanvas.boundingBox();

  // 2. Rotate sideways to inspect the side / non-flat face parts
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    // Rotate to side view (around 75 degrees)
    await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.5, { steps: 25 });
    await page.waitForTimeout(500);

    await emblemStage.screenshot({
      path: new URL("relic-emblem-side.png", artifactDir).pathname,
    });
    console.log("Captured side screenshot");

    // Rotate to angled 3/4 view
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.32, { steps: 20 });
    await page.waitForTimeout(500);

    await emblemStage.screenshot({
      path: new URL("relic-emblem-three-quarter.png", artifactDir).pathname,
    });
    console.log("Captured three-quarter screenshot");

    await page.mouse.up();
  }

  // 3. Full desktop page
  await page.screenshot({
    path: new URL("relic-portfolio-desktop.png", artifactDir).pathname,
    fullPage: false,
  });
  console.log("Captured desktop page screenshot");

  if (errors.length) {
    console.error("Errors encountered:", errors);
  } else {
    console.log("All screenshots captured cleanly without errors!");
  }
} finally {
  await browser.close();
}
