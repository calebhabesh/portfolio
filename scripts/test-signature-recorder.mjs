import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import { parseSignature, signatureBounds } from "../src/lib/signature.js";

const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const allocatedPort = listener.address().port;
    listener.close(() => resolve(allocatedPort));
  });
});
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk; });
server.stderr.on("data", chunk => { serverOutput += chunk; });
const url = `http://127.0.0.1:${port}/tools/signature-recorder/`;
const artifacts = new URL("../.artifacts/signature/", import.meta.url);
let browser;

async function download(page, button, filename) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const item = await pending;
  const destination = new URL(filename, artifacts);
  await item.saveAs(destination.pathname);
  return readFile(destination, "utf8");
}

async function drawMouse(page, offset = 0) {
  const box = await page.locator("#drawing").boundingBox();
  await page.mouse.move(box.x + box.width * 0.2 + offset, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + i * 0.022) + offset, box.y + box.height * (0.5 + Math.sin(i / 2) * 0.2));
  }
  await page.mouse.up();
}

try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* Starting Vite. */ }
    if (i === 99) throw new Error(`Recorder server failed to start: ${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByRole("button", { name: "Download JSON", exact: true }).isDisabled(), true);
  await drawMouse(page);
  await page.waitForTimeout(150);
  await drawMouse(page, 30);
  assert.match(await page.locator("#recording-stats").innerText(), /^2 strokes/);
  let captured = parseSignature(await download(page, "Download JSON", "mouse.json"));
  assert.equal(captured.strokes.length, 2);
  assert.equal(captured.strokes[0].pointerType, "mouse");
  assert.ok(captured.strokes[0].points.length > 15, "Capture the drawing, not only its endpoints.");
  assert.ok(captured.strokes[1].startedAt > captured.strokes[0].endedAt, "Preserve the pen-up pause.");

  const originalPoints = captured.strokes;
  await page.locator("#ink-width").fill("7");
  await page.locator("#use-pressure").uncheck();
  captured = parseSignature(await download(page, "Download JSON", "settings.json"));
  assert.equal(captured.settings.width, 7);
  assert.equal(captured.settings.pressure, false);
  assert.deepEqual(captured.strokes, originalPoints, "Styling must not change raw samples.");
  const svg = await download(page, "Download SVG", "mouse.svg");
  const parsedSVG = await page.evaluate(svgText => {
    const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
    return { errors: document.querySelectorAll("parsererror").length, viewBox: document.documentElement.getAttribute("viewBox"), paths: document.querySelectorAll("path").length, width: document.querySelector("path").getAttribute("stroke-width") };
  }, svg);
  assert.equal(parsedSVG.errors, 0);
  assert.equal(Number(parsedSVG.width), 7);
  assert.ok(parsedSVG.paths > 20);
  assert.ok(Number(parsedSVG.viewBox.split(" ")[2]) < 1000, "Crop SVG to the signature.");

  await page.getByRole("button", { name: "Replay signature", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Stop replay", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Stop replay", exact: true }).click();
  await page.locator("#timing").selectOption("2000");
  await page.getByRole("button", { name: "Replay signature", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Replay complete"));

  await page.reload();
  assert.match(await page.locator("#status").innerText(), /previous draft is restored/);
  assert.match(await page.locator("#recording-stats").innerText(), /^2 strokes/);
  await page.getByRole("button", { name: "Undo stroke", exact: true }).click();
  assert.match(await page.locator("#recording-stats").innerText(), /^1 stroke/);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  assert.equal(await page.locator("#empty-hint").isVisible(), true);
  await page.locator("#import").setInputFiles(new URL("mouse.json", artifacts).pathname);
  await page.waitForFunction(() => document.querySelector("#status").textContent.startsWith("Recording loaded"));
  await page.locator("#import").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"strokes":[]}') });
  await page.waitForFunction(() => document.querySelector("#status").textContent.includes("Choose a signature JSON"));
  assert.match(await page.locator("#recording-stats").innerText(), /^2 strokes/, "A bad import must leave the drawing intact.");

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.locator("#use-pressure").check();
  const session = await context.newCDPSession(page);
  const box = await page.locator("#drawing").boundingBox();
  const penEvent = (type, x, y, force, buttons) => session.send("Input.dispatchMouseEvent", {
    type, x, y, force, buttons, button: "left", clickCount: type === "mousePressed" ? 1 : 0, pointerType: "pen",
  });
  await penEvent("mousePressed", box.x + 160, box.y + 120, 0.15, 1);
  await penEvent("mouseMoved", box.x + 260, box.y + 60, 0.9, 1);
  await penEvent("mouseMoved", box.x + 340, box.y + 180, 0.4, 1);
  await penEvent("mouseReleased", box.x + 350, box.y + 185, 0, 0);
  assert.match(await page.locator("#input-status").innerText(), /pen/);
  assert.match(await page.locator("#pressure-status").innerText(), /Pressure detected/);
  const pen = parseSignature(await download(page, "Download JSON", "pen.json"));
  assert.equal(pen.strokes[0].pointerType, "pen");
  assert.ok(pen.strokes[0].points.some(point => point.pressure > 0.8));
  const penSVG = await download(page, "Download SVG", "pen.svg");
  assert.ok(new Set([...penSVG.matchAll(/stroke-width="([^"]+)"/g)].map(match => match[1])).size > 1, "SVG must retain pressure variation.");
  await page.getByRole("button", { name: "Dark preview", exact: true }).click();
  await page.screenshot({ path: new URL("desktop.png", artifacts).pathname, fullPage: true });
  const accessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(accessibility.violations.map(({ id, nodes }) => ({ id, count: nodes.length })), [], "Recorder accessibility violations.");

  await page.setViewportSize({ width: 375, height: 900 });
  await page.waitForTimeout(100);
  const afterResize = parseSignature(await download(page, "Download JSON", "resized.json"));
  assert.deepEqual(afterResize, pen, "Resizing must preserve capture coordinates.");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Mobile layout must not overflow.");
  await page.screenshot({ path: new URL("mobile.png", artifacts).pathname, fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Replay signature", exact: true }).click();
  assert.match(await page.locator("#status").innerText(), /reduced motion/);
  assert.equal(await page.getByRole("button", { name: "Stop replay", exact: true }).count(), 0);
  assert.deepEqual(errors, [], "Browser exceptions.");

  const touchContext = await browser.newContext({ viewport: { width: 375, height: 900 }, hasTouch: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(url);
  const touchBox = await touchPage.locator("#drawing").boundingBox();
  await touchPage.touchscreen.tap(touchBox.x + touchBox.width / 2, touchBox.y + touchBox.height / 2);
  const dot = parseSignature(await download(touchPage, "Download JSON", "touch.json"));
  assert.equal(dot.strokes[0].pointerType, "touch");
  assert.equal(dot.strokes[0].points.length, 1, "A tap should produce a dot.");
  assert.ok(signatureBounds(dot).width > 0);
  await touchContext.close();
  console.log("Signature recorder passed: mouse/pen/touch capture, pressure, timing, styling, replay, exports, draft restore, imports, responsive layout, reduced motion, and accessibility.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
