import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = new URL("../.artifacts/", import.meta.url);

await mkdir(artifactDir, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../", import.meta.url),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Server failed to start");
}

try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const emblemStage = page.locator('[data-emblem-stage][data-model-state="ready"][data-physics-state="ready"]');
  await emblemStage.waitFor({ timeout: 25000 });

  // Enlarge the hero for inspecting grain, bevels, and side-wall wear.
  await page.addStyleTag({ content: '.emblem-stage { width: 640px !important; max-width: none !important; height: 600px !important; }' });

  // Wait 1.5s for initial render and grass settling
  await page.waitForTimeout(1500);

  // 1. Screenshot front resting pose
  await emblemStage.screenshot({
    path: new URL("test-emblem-front.png", artifactDir).pathname,
  });

  // 2. Drag emblem to expose the side (rotate around Y axis)
  const emblemCanvas = page.locator("#emblem-canvas");
  const box = await emblemCanvas.boundingBox();
  if (box) {
    // Drag horizontally to rotate sideways
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5, { steps: 20 });
    await page.waitForTimeout(400);

    await emblemStage.screenshot({
      path: new URL("test-emblem-side.png", artifactDir).pathname,
    });

    // Drag slightly diagonally for an angled three-quarter view
    await page.mouse.move(box.x + box.width * 0.70, box.y + box.height * 0.35, { steps: 15 });
    await page.waitForTimeout(400);

    await emblemStage.screenshot({
      path: new URL("test-emblem-three-quarter.png", artifactDir).pathname,
    });

    await page.mouse.up();
  }

  // 3. Full page screenshot
  await page.screenshot({
    path: new URL("test-portfolio-desktop.png", artifactDir).pathname,
    fullPage: false,
  });

  console.log("Screenshots captured successfully!");
  if (errors.length) {
    throw new Error(`Browser errors: ${errors.join("\n")}`);
  }

  await browser.close();
} finally {
  server.kill("SIGTERM");
}
