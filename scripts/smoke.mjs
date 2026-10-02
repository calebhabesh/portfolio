import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

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
const artifactDirectory = new URL("../.artifacts/", import.meta.url);
const serverOutput = [];

function parseQuaternion(value) {
  const components = String(value || "").split(",").map(Number);
  assert.equal(components.length, 4, `Invalid scene quaternion: ${value}`);
  assert.ok(components.every(Number.isFinite), `Invalid scene quaternion: ${value}`);
  return components;
}

function quaternionDistance(first, second) {
  const dot = Math.abs(first.reduce((sum, value, index) => sum + value * second[index], 0));
  const firstLength = Math.hypot(...first);
  const secondLength = Math.hypot(...second);
  return 2 * Math.acos(Math.min(1, dot / (firstLength * secondLength)));
}

await mkdir(artifactDirectory, { recursive: true });

const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Preview server did not start.\n${serverOutput.join("")}`);
}

async function checkPage(browser, viewport, screenshotName) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
      console.error(`[BROWSER ERROR]: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`page: ${error.message}`);
    console.error(`[PAGE ERROR]: ${error.message}`);
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const emblemStage = page.locator(
    '[data-emblem-stage][data-model-state="ready"][data-physics-state="ready"]',
  );
  try {
    await emblemStage.waitFor({ timeout: 30_000 });
  } catch (err) {
    const debugInfo = await page.evaluate(() => {
      const stage = document.querySelector("[data-emblem-stage]");
      return {
        modelState: stage?.dataset.modelState,
        physicsState: stage?.dataset.physicsState,
        errorMessage: stage?.dataset.errorMessage,
        statusText: stage?.querySelector("[data-emblem-status]")?.textContent,
      };
    }).catch(() => null);
    console.error("[SMOKE TIMEOUT DEBUG]:", debugInfo);
    throw err;
  }
  await page.waitForFunction(
    () => Boolean(document.querySelector("[data-emblem-stage]")?.dataset.orientation),
  );
  assert.equal(await emblemStage.getAttribute("data-motion-state"), "idle");
  assert.equal(await page.locator("[data-emblem-status], .status-spinner").count(), 0);
  assert.equal(await emblemStage.getAttribute("data-rendered"), "true");
  const assetRequests = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => /(?:glb|bin).*\.gzip/.test(entry.name)).map((entry) => entry.name));
  assert.equal(assetRequests.length, 2, "Each compressed hero asset should be fetched once, reusing its preload.");
  const modelReadyTime = Number(await emblemStage.getAttribute("data-model-ready-ms"));
  const physicsReadyTime = Number(await emblemStage.getAttribute("data-physics-ready-ms"));
  const runtimeCollisionBuildTime = Number(
    await emblemStage.getAttribute("data-collision-build-ms"),
  );
  assert.ok(
    Number.isFinite(modelReadyTime) && Number.isFinite(physicsReadyTime),
    "The emblem did not publish its staged startup timing.",
  );
  assert.ok(
    modelReadyTime <= physicsReadyTime,
    `Grass physics reported ready before the visible model (${modelReadyTime.toFixed(1)}ms vs ${physicsReadyTime.toFixed(1)}ms).`,
  );
  assert.equal(
    runtimeCollisionBuildTime,
    0,
    "The browser rebuilt collision data instead of using the precomputed field.",
  );
  assert.ok(
    Number.isFinite(Number(await emblemStage.getAttribute("data-grass-bend"))),
    "The grass solver did not publish a finite bend value.",
  );

  assert.equal(await page.title(), "Caleb Habesh");
  assert.match(await page.locator("h1").innerText(), /Caleb Habesh/);
  assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"), "/favicon.svg");
  assert.match(await page.locator(".brand-script").innerText(), /ካሌብ/);
  assert.equal(await page.locator("article[data-project]").count(), 5);
  const projectIds = await page.locator("article[data-project]").evaluateAll(
    (articles) => articles.map((el) => el.getAttribute("data-project"))
  );
  assert.deepEqual(
    projectIds,
    ["doorlink", "linewatch", "file-sync", "courtload", "medical-imaging"],
    `Expected project order Doorlink, LineWatchTO, File Sync, CourtLoad, Medical Image Processing. Got: ${projectIds.join(", ")}`
  );

  const projectTitles = (await page.locator("article[data-project] .project-box-title").allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(
    projectTitles,
    ["Doorlink", "LineWatchTO", "File Sync", "CourtLoad", "Medical Image Processing"],
    `Expected exact titles. Got: ${projectTitles.join(", ")}`
  );
  assert.equal(await page.locator(".project-badge").count(), 0, "Project status badges should be absent.");
  assert.equal(await page.locator("#ripple-background").count(), 0, "The background ripple layer should be absent.");

  const rifttraceCount = await page.locator('[data-project="rifttrace"]').count();
  assert.equal(rifttraceCount, 0, "RiftTrace should be absent from the active site.");

  assert.match(
    (await page.locator(".hero-intro").allInnerTexts()).join(" "),
    /full-stack tools, connected devices, and reliable data systems/,
    "Hero intro should describe the work shown in the projects."
  );

  // Compact previews reserve their layout before lazy image decoding finishes.
  const previews = await page.locator("article[data-project] img").evaluateAll(images =>
    images.map(image => ({
      preview: Boolean(image.closest(".project-card-preview")),
      width: Number(image.getAttribute("width")),
      height: Number(image.getAttribute("height")),
      loading: image.loading,
      decoding: image.decoding,
    })),
  );
  assert.ok(previews.length > 0, "Project preview thumbnails should be present.");
  assert.ok(previews.every(image => image.preview && image.width > 0 && image.height > 0 &&
    image.loading === "lazy" && image.decoding === "async"),
    "Card previews should reserve space and decode asynchronously without eager loading.");

  // Downward pointing scroll arrow button
  const scrollArrow = page.locator("[data-projects-scroll-arrow]");
  assert.equal(await scrollArrow.count(), 1, "Scroll arrow button should exist.");
  assert.equal(
    await scrollArrow.evaluate((btn) => !btn.classList.contains("is-hidden")),
    true,
    "Scroll arrow should be visible on initial load when projects are below fold."
  );

  // Project destinations
  assert.ok(await page.locator('article[data-project="doorlink"] a[href="https://github.com/calebhabesh/doorlink"]').count() >= 1, "Doorlink GitHub link missing.");
  assert.ok(await page.locator('article[data-project="linewatch"] a[href="https://linewatchto.ca"]').count() >= 1, "LineWatchTO live link missing.");
  assert.ok(await page.locator('article[data-project="linewatch"] a[href="https://github.com/calebhabesh/linewatchto"]').count() >= 1, "LineWatchTO GitHub link missing.");
  assert.equal(await page.locator('article[data-project="file-sync"] .project-icon-link').count(), 0, "File Sync should not link to its unpublished repository.");
  assert.equal(await page.locator('article[data-project="courtload"] .project-icon-link').count(), 0, "CourtLoad should not link to its unpublished repository.");
  assert.ok(await page.locator('article[data-project="medical-imaging"] a[href="https://github.com/calebhabesh/NM03-Capstone-Project"]').count() >= 1, "Medical Imaging GitHub link missing.");
  assert.equal(await page.locator('article[data-project="linewatch"] .project-icon-link').count(), 2, "LineWatchTO needs both live and GitHub actions.");

  const idleOrientationBefore = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  const averageFrameTime = await page.evaluate(() => new Promise((resolve) => {
    const samples = [];
    let previous;
    function sampleFrame(now) {
      if (previous !== undefined) samples.push(now - previous);
      previous = now;
      if (samples.length < 60) requestAnimationFrame(sampleFrame);
      else resolve(samples.reduce((sum, sample) => sum + sample, 0) / samples.length);
    }
    requestAnimationFrame(sampleFrame);
  }));
  const idleOrientationAfter = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  assert.ok(
    quaternionDistance(idleOrientationBefore, idleOrientationAfter) > 0.025,
    "The emblem did not continue its ambient rotation.",
  );
  const physicsTime = Number(await emblemStage.getAttribute("data-physics-ms") || 0);
  assert.ok(
    averageFrameTime < 200,
    `The interactive hero averaged ${averageFrameTime.toFixed(1)}ms per frame at ${viewport.width}px; the latest physics step used ${physicsTime.toFixed(1)}ms.`,
  );
  assert.ok(
    physicsTime < 20,
    `The dense grass physics step used ${physicsTime.toFixed(1)}ms at ${viewport.width}px.`,
  );

  const accessibility = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    accessibility.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })),
    [],
    JSON.stringify(accessibility.violations, null, 2),
  );

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `Page has ${overflow}px of horizontal overflow at ${viewport.width}px.`);

  const collisionEventsBefore = Number(await emblemStage.getAttribute("data-collision-events") || 0);
  const pivotBeforeDrag = Number(await emblemStage.getAttribute("data-pivot-y"));
  const emblemCanvas = page.locator("#emblem-canvas");
  await emblemCanvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  const canvasBounds = await emblemCanvas.boundingBox();
  assert.ok(canvasBounds, "The emblem canvas has no rendered bounds.");
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.5, canvasBounds.y + canvasBounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.78, canvasBounds.y + canvasBounds.height * 0.28, { steps: 12 });
  await page.waitForTimeout(100);
  const heldOrientationBefore = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  await page.waitForTimeout(500);
  const heldOrientationAfter = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  assert.equal(await emblemStage.getAttribute("data-motion-state"), "dragging");
  const heldAngularSpeed = Number(
    await emblemStage.getAttribute("data-drag-angular-speed"),
  );
  assert.ok(
    heldAngularSpeed <= 4.81,
    `Live manipulation exceeded its angular-speed cap at ${viewport.width}px (${heldAngularSpeed.toFixed(4)} rad/s).`,
  );
  assert.ok(
    quaternionDistance(heldOrientationBefore, heldOrientationAfter) < 0.001,
    `The emblem kept moving while the pointer was held at ${viewport.width}px.`,
  );
  if (viewport.width >= 1000) {
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 1.02,
      canvasBounds.y + canvasBounds.height * 0.5,
      { steps: 8 },
    );
    const orientationAtCanvasEdge = parseQuaternion(
      await emblemStage.getAttribute("data-orientation"),
    );
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 1.18,
      canvasBounds.y + canvasBounds.height * 0.5,
      { steps: 8 },
    );
    await page.waitForTimeout(50);
    const orientationPastCanvasEdge = parseQuaternion(
      await emblemStage.getAttribute("data-orientation"),
    );
    assert.ok(
      quaternionDistance(orientationAtCanvasEdge, orientationPastCanvasEdge) > 0.15,
      "Horizontal drag input stopped rotating after crossing the old trackball boundary.",
    );
  }
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.24, canvasBounds.y + canvasBounds.height * 0.35, { steps: 12 });
  await page.mouse.up();
  const returnOffsetOnRelease = Number(
    await emblemStage.getAttribute("data-orientation-offset"),
  );
  const pivotAfterDrag = Number(await emblemStage.getAttribute("data-pivot-y"));
  assert.ok(
    Number.isFinite(pivotBeforeDrag) && Math.abs(pivotAfterDrag - pivotBeforeDrag) < 0.00001,
    `The emblem pivot translated during manipulation at ${viewport.width}px (${pivotBeforeDrag} → ${pivotAfterDrag}).`,
  );
  await page.waitForFunction(
    (before) => Number(document.querySelector("[data-emblem-stage]")?.dataset.collisionEvents || 0) > before,
    collisionEventsBefore,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(280);
  const collisionBend = Number(await emblemStage.getAttribute("data-grass-bend"));
  const collisionPenetration = Number(
    await emblemStage.getAttribute("data-grass-penetration"),
  );
  assert.ok(
    collisionBend > 0.001 && collisionBend <= 0.68,
    `Grass collision bend escaped its physical range at ${viewport.width}px (${collisionBend}).`,
  );
  assert.ok(
    collisionPenetration <= 0.04,
    `Grass probes penetrated the rigid emblem at ${viewport.width}px (${collisionPenetration}).`,
  );
  if (viewport.width >= 1000) {
    await emblemStage.screenshot({
      path: new URL("portfolio-collision-desktop.png", artifactDirectory).pathname,
    });
  }
  const orientationAfterRelease = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  await page.waitForTimeout(650);
  const orientationAfterInertia = parseQuaternion(
    await emblemStage.getAttribute("data-orientation"),
  );
  const postReleaseDistance = quaternionDistance(
    orientationAfterRelease,
    orientationAfterInertia,
  );
  assert.ok(
    postReleaseDistance > 0.025,
    `The emblem stopped rotating after pointer release at ${viewport.width}px (${postReleaseDistance.toFixed(4)} radians; ${orientationAfterRelease.join(",")} → ${orientationAfterInertia.join(",")}).`,
  );
  assert.equal(await emblemStage.getAttribute("data-motion-state"), "returning");
  const returnOffsetBefore = Number(
    await emblemStage.getAttribute("data-orientation-offset"),
  );
  await page.waitForTimeout(2_200);
  const returnOffsetAfter = Number(
    await emblemStage.getAttribute("data-orientation-offset"),
  );
  assert.ok(
    returnOffsetAfter < Math.max(0.035, returnOffsetOnRelease * 0.5),
    `The emblem did not flow back toward its moving idle orientation at ${viewport.width}px (${returnOffsetOnRelease.toFixed(4)} → ${returnOffsetBefore.toFixed(4)} → ${returnOffsetAfter.toFixed(4)} radians).`,
  );
  await page.waitForFunction(
    () => document.querySelector("[data-emblem-stage]")?.dataset.motionState === "idle",
    undefined,
    { timeout: 8_000 },
  );
  const recalibratedAngularSpeed = Number(
    await emblemStage.getAttribute("data-angular-speed"),
  );
  assert.ok(
    recalibratedAngularSpeed >= 0.35,
    `The emblem stopped as recalibration completed at ${viewport.width}px (${recalibratedAngularSpeed.toFixed(4)} rad/s).`,
  );
  const settledOffset = Number(
    await emblemStage.getAttribute("data-orientation-offset"),
  );
  assert.ok(
    settledOffset < 0.02,
    `The emblem missed its deterministic upright orientation at ${viewport.width}px (${settledOffset.toFixed(4)} radians).`,
  );
  await emblemCanvas.evaluate((canvas) => {
    canvas.focus();
    for (let index = 0; index < 21; index += 1) {
      canvas.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }));
    }
  });
  await page.waitForTimeout(100);
  const invertedOffset = Number(
    await emblemStage.getAttribute("data-orientation-offset"),
  );
  const invertedFloorClearance = Number(
    await emblemStage.getAttribute("data-floor-clearance"),
  );
  assert.ok(
    invertedOffset > 2.5,
    `The floor test did not invert the emblem at ${viewport.width}px (${invertedOffset.toFixed(4)} radians).`,
  );
  assert.ok(
    invertedFloorClearance >= 0.03,
    `The inverted emblem crossed the grass floor at ${viewport.width}px (${invertedFloorClearance.toFixed(4)} units of clearance).`,
  );
  await emblemCanvas.press("Home");
  await page.waitForTimeout(550);
  await emblemCanvas.evaluate((canvas) => canvas.blur());

  const doorlinkDetails = page.locator('[data-project="doorlink"] .project-details-button');
  await doorlinkDetails.click();
  const notesDialog = page.getByRole("dialog");
  await notesDialog.waitFor();
  assert.match(await notesDialog.innerText(), /Project Notes/i);
  assert.match(await notesDialog.innerText(), /Custom Hardware/);
  await page.keyboard.press("Escape");
  await notesDialog.waitFor({ state: "hidden" });

  const doorlinkTitleButton = page.locator('article[data-project="doorlink"] h3 button');
  await doorlinkTitleButton.focus();
  const focusedCard = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.closest(".project-box")?.getAttribute("data-project");
  });
  assert.equal(focusedCard, "doorlink", "Keyboard focus could not target project card controls.");
  await doorlinkTitleButton.press("Enter");
  await notesDialog.waitFor();
  assert.match(await notesDialog.innerText(), /Custom Hardware/,
    "Activating the project title must open its details.");
  await page.keyboard.press("Escape");
  await notesDialog.waitFor({ state: "hidden" });
  assert.ok(await doorlinkTitleButton.evaluate(element => element === document.activeElement),
    "Closing details must return keyboard focus to the project title.");

  const expandButton = page.locator('[data-project="doorlink"] .project-expand-button');
  await expandButton.hover();
  assert.equal(await page.locator("canvas:not(.grid-pointer-trail):not(.gutter-maze-search)").count(), 1,
    "Card hover should not create another WebGL canvas.");
  assert.equal(await page.locator(".grid-pointer-trail").count(), 1,
    "The page should have one decorative trail canvas.");
  assert.equal(await page.locator(".grid-pointer-trail").evaluate(canvas =>
    canvas.getContext("2d") instanceof CanvasRenderingContext2D), true,
    "The grid trail should use 2D rendering independently of the WebGL hero.");
  await expandButton.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    true,
    "Opening a project dialog should move keyboard focus inside it.",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    true,
    "Shift+Tab should stay inside the project dialog.",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await expandButton.evaluate((element) => element === document.activeElement),
    true,
    "Closing a project dialog should restore focus to its expand button.",
  );

  const originalTheme = await page.locator("html").getAttribute("data-theme");
  await page.locator("[data-theme-toggle]").click();
  assert.notEqual(await page.locator("html").getAttribute("data-theme"), originalTheme);
  if (viewport.width >= 1000) {
    await page.screenshot({
      path: new URL("portfolio-dark.png", artifactDirectory).pathname,
      fullPage: true,
    });
  }
  await page.locator("[data-theme-toggle]").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), originalTheme);

  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += Math.max(320, window.innerHeight * 0.7)) {
      window.scrollTo({ top, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 55));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(450);

  await page.screenshot({
    path: new URL(screenshotName, artifactDirectory).pathname,
    fullPage: true,
  });

  assert.deepEqual(errors, [], errors.join("\n"));
  await context.close();
}

async function checkReducedMotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  assert.equal(await page.locator("article[data-project]").count(), 5);
  await page.locator('[data-project="doorlink"] .project-details-button').click();
  await page.getByRole("dialog").waitFor();
  assert.match(await page.getByRole("dialog").innerText(), /Custom Hardware/);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });

  const cursorVisible = await page.evaluate(() => {
    const cursor = document.querySelector(".target-cursor-wrapper");
    if (!cursor) return false;
    const style = window.getComputedStyle(cursor);
    return style.display !== "none" && style.opacity !== "0";
  });
  assert.equal(cursorVisible, false, "Target cursor should remain inactive under prefers-reduced-motion.");

  await context.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });
  await checkPage(browser, { width: 1440, height: 1000 }, "portfolio-desktop.png");
  await checkPage(browser, { width: 768, height: 1024 }, "portfolio-tablet.png");
  await checkPage(browser, { width: 390, height: 844 }, "portfolio-mobile.png");
  await checkPage(browser, { width: 320, height: 600 }, "portfolio-320px.png");
  await checkReducedMotion(browser);
  console.log("Smoke checks passed for all responsive viewports, keyboard focus, and reduced-motion.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
