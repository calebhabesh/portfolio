import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import { parseSignature, signatureSVG } from "../src/lib/signature.js";

const recording = parseSignature(await readFile(new URL("../src/assets/signature/caleb.json", import.meta.url), "utf8"));
assert.equal(signatureSVG(recording), await readFile(new URL("../src/assets/signature/caleb.svg", import.meta.url), "utf8"), "Footer artwork and movement must come from the same take.");
const port = await new Promise((resolve, reject) => {
  const listener = createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const allocatedPort = listener.address().port;
    listener.close(() => resolve(allocatedPort));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk; });
server.stderr.on("data", chunk => { serverOutput += chunk; });
const artifacts = new URL("../.artifacts/signature/footer/", import.meta.url);
let browser;

async function getFooterLayout(page) {
  return page.evaluate(() => {
    const bounds = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      footer: bounds(".site-footer"), email: bounds(".footer-email"),
      signature: bounds(".footer-signature"), byline: bounds(".footer-byline"),
      artwork: bounds(".footer-signature-art"),
      color: getComputedStyle(document.querySelector(".footer-signature")).color,
      artworkVisible: getComputedStyle(document.querySelector(".footer-signature-art")).visibility,
      mask: getComputedStyle(document.querySelector(".footer-signature-art")).maskImage,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

async function originalFooterHeight(page) {
  return page.evaluate(() => {
    const footer = document.querySelector(".site-footer");
    const signature = document.querySelector(".footer-signature");
    const originalStyle = footer.getAttribute("style");
    const signatureStyle = signature.getAttribute("style");
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";
    footer.style.gap = "0";
    signature.style.display = "none";
    const height = footer.getBoundingClientRect().height;
    if (originalStyle === null) footer.removeAttribute("style");
    else footer.setAttribute("style", originalStyle);
    if (signatureStyle === null) signature.removeAttribute("style");
    else signature.setAttribute("style", signatureStyle);
    return height;
  });
}

async function waitForScrollCue(page) {
  // The existing fixed cue fades after reaching the last project. Wait for that
  // independent transition before reviewing the footer's final pixels.
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-projects-scroll-arrow]")).opacity === "0");
}

try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch { /* Starting preview. */ }
    if (attempt === 99) throw new Error(`Preview failed to start: ${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const page = await context.newPage();
  const exceptions = [];
  page.on("pageerror", error => exceptions.push(error.message));
  await page.goto(baseUrl);
  await page.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "pending");
  assert.equal((await getFooterLayout(page)).footer.height, await originalFooterHeight(page), "Adding the signature must not increase the original footer height.");
  assert.equal((await getFooterLayout(page)).artworkVisible, "hidden", "Keep the signature blank until it enters view.");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "drawing");
  const timeline = await page.locator(".footer-signature > svg").evaluate(svg => {
    const pieces = [...svg.querySelectorAll("path, circle")];
    return {
      count: pieces.length,
      dots: pieces.filter(piece => piece.tagName === "circle").map(piece => piece.getAnimations()[0].effect.getTiming().delay),
      widths: [...new Set(pieces.filter(piece => piece.tagName === "path").map(piece => piece.getAttribute("stroke-width")))],
      duration: Math.max(...pieces.map(piece => {
        const timing = piece.getAnimations()[0].effect.getTiming();
        return timing.delay + timing.duration;
      })),
    };
  });
  assert.ok(timeline.count > 150, "Animate the recorded pen curves.");
  assert.deepEqual(timeline.dots, recording.strokes.map(stroke => stroke.points[0].time + 120), "Respect the recorded pen lifts.");
  assert.ok(timeline.widths.length > 10, "Retain pressure variation.");
  assert.ok(Math.abs(timeline.duration - (recording.strokes.at(-1).points.at(-1).time + 120)) <= 1, "Use the original drawing duration.");
  await page.waitForTimeout(300);
  const progress = await page.locator(".footer-signature > svg").evaluate(svg => [...svg.querySelectorAll("path")].map(path => Number(getComputedStyle(path).opacity)));
  assert.ok(progress.some(value => value > 0) && progress.some(value => value === 0), "Reveal strokes progressively, not all at once.");
  await page.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "complete");
  assert.equal(await page.locator(".footer-signature > svg").count(), 0, "Settle to the original exported artwork.");
  let layout = await getFooterLayout(page);
  assert.equal(layout.artworkVisible, "visible");
  assert.notEqual(layout.mask, "none");
  assert.ok(Math.abs(layout.signature.x + layout.signature.width / 2 - (layout.email.x + layout.email.width + layout.byline.x) / 2) < 1, "Center the signature in the space between the email and byline.");
  assert.ok(layout.email.x < layout.signature.x && layout.signature.x < layout.byline.x);
  await waitForScrollCue(page);
  await page.locator(".site-footer").screenshot({ path: new URL("desktop-light.png", artifacts).pathname });
  const lightColor = layout.color;
  await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  layout = await getFooterLayout(page);
  assert.notEqual(layout.color, lightColor, "The signature must inherit dark theme ink.");
  assert.equal(await page.locator("[data-footer-signature]").getAttribute("data-signature-state"), "complete", "Changing theme must not replay the signature.");
  await waitForScrollCue(page);
  await page.locator(".site-footer").screenshot({ path: new URL("desktop-dark.png", artifacts).pathname });
  const axe = await new AxeBuilder({ page }).include(".site-footer").analyze();
  assert.deepEqual(axe.violations.map(({ id }) => id), []);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  assert.equal(await page.locator("[data-footer-signature]").getAttribute("data-signature-state"), "complete", "Scroll back must not restart playback.");
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".site-footer").scrollIntoViewIfNeeded();
    layout = await getFooterLayout(page);
    assert.equal(layout.overflow, false, `Footer should fit at ${width}px.`);
    assert.equal(layout.footer.height, await originalFooterHeight(page), `Preserve the original footer height at ${width}px.`);
    assert.ok(layout.email.x + layout.email.width <= layout.signature.x + 1);
    assert.ok(layout.signature.x + layout.signature.width <= layout.byline.x + 1);
    assert.ok(layout.artwork.y >= layout.footer.y && layout.artwork.y + layout.artwork.height <= layout.footer.y + layout.footer.height,
      `Keep the signature within the original footer boundaries at ${width}px.`);
    await waitForScrollCue(page);
    await page.locator(".site-footer").screenshot({ path: new URL(`${width}px.png`, artifacts).pathname });
  }
  assert.deepEqual(exceptions, []);
  await page.close();

  const reducedPage = await browser.newPage({ reducedMotion: "reduce" });
  await reducedPage.goto(baseUrl);
  await reducedPage.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "complete");
  await reducedPage.locator(".site-footer").scrollIntoViewIfNeeded();
  assert.equal((await getFooterLayout(reducedPage)).artworkVisible, "visible");
  assert.equal(await reducedPage.locator(".footer-signature > svg").count(), 0);
  await reducedPage.close();

  const interruptedPage = await browser.newPage();
  await interruptedPage.goto(baseUrl);
  await interruptedPage.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "pending");
  await interruptedPage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await interruptedPage.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "drawing");
  await interruptedPage.emulateMedia({ reducedMotion: "reduce" });
  await interruptedPage.waitForFunction(() => document.querySelector("[data-footer-signature]").dataset.signatureState === "complete");
  await interruptedPage.locator(".site-footer").scrollIntoViewIfNeeded();
  assert.equal((await getFooterLayout(interruptedPage)).artworkVisible, "visible", "Changing motion preference during playback must finish it.");
  await interruptedPage.close();

  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await staticPage.goto(baseUrl);
  await staticPage.locator(".site-footer").scrollIntoViewIfNeeded();
  assert.equal(await staticPage.locator("[data-footer-signature]").getAttribute("data-signature-state"), null);
  const staticLayout = await getFooterLayout(staticPage);
  assert.equal(staticLayout.artworkVisible, "visible");
  assert.notEqual(staticLayout.mask, "none", "No-JS visits need the complete SVG.");
  await staticPage.locator(".site-footer").screenshot({ path: new URL("no-js.png", artifacts).pathname });
  await staticPage.close();
  console.log("Footer signature passed: actual recording timing and pressure, progressive reveal, no replay, both themes, responsive layout, reduced motion, no-JS artwork, and accessibility.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
