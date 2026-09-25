import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const port = 4176;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../", import.meta.url),
  stdio: "ignore",
});

let browser;
try {
  const deadline = Date.now() + 20_000;
  while (true) {
    try {
      if ((await fetch(baseUrl)).ok) break;
    } catch {
      if (Date.now() >= deadline) throw new Error("Preview server did not start.");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('[data-emblem-stage][data-model-state="ready"]').waitFor();
    const card = page.locator('[data-project="doorlink"]');
    const button = page.locator('[data-project="doorlink"] .project-expand-button');
    await button.scrollIntoViewIfNeeded();
    await button.hover();
    const bounds = await card.boundingBox();
    assert.ok(bounds, "The project card has no rendered bounds.");
    await page.mouse.move(bounds.x + 50, bounds.y + 100);
    await page.waitForTimeout(180);
    const comet = page.locator('.project-comet-card').first().locator(':scope > div').first();
    const firstTransform = await comet.evaluate((element) => element.style.transform);
    await page.mouse.move(bounds.x + 150, bounds.y + 100);
    await page.waitForTimeout(180);
    const secondTransform = await comet.evaluate((element) => element.style.transform);
    assert.notEqual(secondTransform, firstTransform, "The Comet Card did not respond to the pointer.");
    assert.ok(!secondTransform.includes('scale'), "The Comet Card should not scale up on hover.");
    assert.equal(
      await page.locator('.project-comet-card').first().locator('.comet-glare').evaluate((element) => getComputedStyle(element).opacity),
      "1",
      "The subtle Comet glare did not appear on hover.",
    );
    if (width >= 1000) {
      const stage = page.locator("[data-emblem-stage]");
      const visible = await stage.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top < innerHeight && bounds.bottom > 0;
      });
      assert.equal(visible, true, "The emblem must be visible during the card hover check.");
      const orientationBefore = await stage.getAttribute("data-orientation");
      await page.waitForTimeout(500);
      assert.notEqual(
        await stage.getAttribute("data-orientation"),
        orientationBefore,
        "Hovering a project card paused the visible 3D emblem.",
      );
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    const result = await page.evaluate(async () => {
      const samples = [];
      const emblem = document.querySelector("[data-emblem-stage]");
      const orientationBefore = emblem?.dataset.orientation;
      const start = performance.now();
      document.querySelector('[data-project="doorlink"] .project-expand-button').click();
      while (performance.now() - start < 1200) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const dialog = document.querySelector('[role="dialog"]');
        const rect = dialog?.getBoundingClientRect();
        samples.push({ t: performance.now() - start, x: rect?.x, y: rect?.y, width: rect?.width, height: rect?.height });
      }
      const final = samples.at(-1);
      const settled = samples.find((sample, index) => sample.width && samples.slice(index).every((later) =>
        later.width &&
        Math.abs(later.x - final.x) < 2 &&
        Math.abs(later.y - final.y) < 2 &&
        Math.abs(later.width - final.width) < 2 &&
        Math.abs(later.height - final.height) < 2,
      ));
      return {
        firstMs: samples.find((sample) => sample.width)?.t,
        settledMs: settled?.t,
        projectPauseFlag: document.body.hasAttribute("data-project-interacting") || document.body.dataset.projectDialogOpen === "true",
        orientationBefore,
        orientationAfter: emblem?.dataset.orientation,
      };
    });

    assert.equal(result.projectPauseFlag, false, "Project interactions must not control the 3D hero.");
    if (width >= 1000) {
      assert.notEqual(result.orientationAfter, result.orientationBefore, "The project dialog paused the visible 3D emblem.");
    }
    assert.ok(result.firstMs < 150, `Dialog appeared after ${result.firstMs?.toFixed(0)} ms at ${width}px.`);
    assert.ok(result.settledMs < 600, `Dialog took ${result.settledMs?.toFixed(0)} ms to settle at ${width}px.`);
    console.log(`${width}px: visible in ${result.firstMs.toFixed(0)} ms, settled in ${result.settledMs.toFixed(0)} ms`);
    await page.close();
  }

  const galleryPage = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await galleryPage.goto(baseUrl, { waitUntil: "networkidle" });
  for (const [projectId, imagePaths] of [
    ["doorlink", ["/projects/doorlink-enclosure.jpg", "/projects/doorlink-pcb.jpg", "/projects/doorlink-wiring.webp", "/projects/doorlink-pcb-3d.png"]],
    ["linewatch", ["/projects/linewatch-onboarding-map.png", "/projects/linewatch-onboarding-impact.png", "/projects/linewatch-onboarding-personal.png"]],
    ["file-sync", ["/projects/filesync-history.png", "/projects/filesync-folders.png", "/projects/filesync-conflicts.png"]],
    ["courtload", ["/projects/courtload-comparison.png", "/projects/courtload-evaluation.png"]],
    ["medical-imaging", ["/projects/medical-segmentation.png", "/projects/medical-pipelines.png"]],
  ]) {
    await galleryPage.locator(`[data-project="${projectId}"] .project-expand-button`).click();
    const dialog = galleryPage.getByRole("dialog");
    const image = dialog.locator(".project-gallery-stage img");
    const thumbnails = dialog.locator('.project-gallery-thumbnail');
    await thumbnails.first().waitFor();
    assert.equal(await thumbnails.count(), imagePaths.length);
    for (const [index, imagePath] of imagePaths.entries()) {
      await thumbnails.nth(index).click();
      assert.equal(await image.getAttribute("src"), imagePath);
      assert.ok(await image.getAttribute("alt"), `${projectId} is missing descriptive image text.`);
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async (element) => {
        if (!element.complete) await new Promise((resolve, reject) => {
          element.addEventListener("load", resolve, { once: true });
          element.addEventListener("error", reject, { once: true });
        });
      });
      assert.ok(await image.evaluate((element) => element.naturalWidth > 0), `${projectId} gallery image ${index + 1} failed to load.`);
      assert.equal(await dialog.getByRole("link", { name: "View full image" }).getAttribute("href"), imagePath);
      assert.equal(await thumbnails.nth(index).getAttribute("aria-pressed"), "true");
    }
    assert.doesNotMatch(await dialog.locator(".project-dialog-link").first().innerText(), /↗/);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await dialog.waitFor({ state: "detached" });
  }
  await galleryPage.close();

  const reducedPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
  const reducedCard = reducedPage.locator('.project-comet-card').first();
  await reducedCard.scrollIntoViewIfNeeded();
  const reducedInner = reducedCard.locator(':scope > div').first();
  const restingTransform = await reducedInner.evaluate((element) => element.style.transform);
  const reducedBounds = await reducedCard.boundingBox();
  assert.ok(reducedBounds, "The reduced-motion project card has no rendered bounds.");
  await reducedPage.mouse.move(reducedBounds.x + 70, reducedBounds.y + 100);
  await reducedPage.mouse.move(reducedBounds.x + 170, reducedBounds.y + 100);
  await reducedPage.waitForTimeout(200);
  assert.equal(
    await reducedInner.evaluate((element) => element.style.transform),
    restingTransform,
    "The Comet Card moved despite a reduced-motion preference.",
  );
  await reducedPage.close();
} finally {
  await browser?.close();
  server.kill();
}
