import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright-core";
import { createServer } from "node:net";

const directory = await mkdtemp(join(tmpdir(), "portfolio-paper-test-"));
try {
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const asset = css.match(/url\("(?:\.\/|\/src\/)assets\/(paper-grain\.[^"]+)"\)/)[1];
  const texture = new URL(`../src/assets/${asset}`, import.meta.url).href;
  const html = join(directory, "texture.html");
  const screenshot = join(directory, "texture.png");
  await writeFile(html, `<!doctype html><style>
    body { margin: 0; background: #121b16; }
    div { margin: 20px; width: 920px; height: 300px; zoom: .9;
      background: #294652 url("${texture}"); }
    </style><div></div>`);
  await promisify(execFile)(process.env.FIREFOX_PATH || "/usr/bin/firefox", [
    "--headless", "--no-remote", "--profile", directory,
    "--window-size", "1000,350", "--screenshot", screenshot, pathToFileURL(html).href,
  ], { timeout: 20000 });
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const brightness = x => {
    let sum = 0;
    for (let y = 30; y < 270; y++) {
      const index = (y * info.width + x) * 3;
      sum += (data[index] + data[index + 1] + data[index + 2]) / 3;
    }
    return sum / 240;
  };
  // Check both mirrored joins and the repeat boundary at fractional scale.
  // The original SVG caused 9–17 levels of darkening at these exact columns.
  for (const boundary of [230, 443, 655]) {
    const surroundings = (brightness(boundary - 2) + brightness(boundary + 2)) / 2;
    assert.ok(surroundings - brightness(boundary) < 2,
      `Paper texture must not draw a dark seam at scaled tile boundary ${boundary}.`);
  }
  console.log("Paper texture passed: no mirrored or repeated tile seams in Firefox at 90% scale.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

// Exercise Vite's injected CSS on the actual cards, not just the asset.
// Relative URLs previously resolved against the page and returned HTML.
const port = await new Promise(resolve => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url), stdio: "ignore",
});
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Dev server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
    await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    const card = page.locator(".project-box").first();
    const decoded = await card.evaluate(async element => {
      const url = getComputedStyle(element).backgroundImage.match(/url\("([^"]+)"\)/)[1];
      const image = new Image();
      image.src = url;
      try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
    });
    assert.ok(decoded, "The actual card's paper texture URL must decode as an image in Vite dev mode.");
    const bounds = await card.boundingBox();
    const clip = { x: bounds.x + 20, y: bounds.y + 10, width: 100, height: 10 };
    const textured = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer();
    await card.evaluate(element => {
      element.style.backgroundImage = getComputedStyle(element).backgroundImage.replace(/^url\("[^"]+"\),\s*/, "");
    });
    const flat = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer();
    const difference = Math.max(...textured.map((value, index) => Math.abs(value - flat[index])));
    assert.ok(difference >= 10, `Paper grain must visibly affect the ${theme} card (pixel difference: ${difference}).`);
    await page.close();
  }
  console.log("Actual project cards passed: texture loads and paints in both themes through Vite dev CSS.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
