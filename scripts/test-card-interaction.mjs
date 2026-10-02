import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import sharp from "sharp";

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
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });

  // The correct page canvas must exist even before CSS and main JS arrive.
  for (const { system, saved, expected, unavailable } of [
    { system: "dark", expected: "dark" },
    { system: "light", saved: "dark", expected: "dark" },
    { system: "dark", saved: "light", expected: "light" },
    { system: "light", saved: "invalid", expected: "light" },
    { system: "dark", unavailable: true, expected: "dark" },
  ]) {
    const page = await browser.newPage({ colorScheme: system });
    await page.addInitScript(({ saved, unavailable }) => {
      if (unavailable) Object.defineProperty(window, "localStorage", {
        get() { throw new Error("Storage unavailable"); },
      });
      else if (saved) localStorage.setItem("caleb-portfolio-theme", saved);
    }, { saved, unavailable });
    await page.route("**/*", (route) => {
      if (["stylesheet", "script"].includes(route.request().resourceType())) return route.abort();
      return route.continue();
    });
    for (const refresh of [false, true]) {
      if (refresh) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      assert.deepEqual(await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        canvas: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        chrome: document.querySelector('meta[name="theme-color"]').content,
      })), {
        theme: expected,
        canvas: expected === "dark" ? "rgb(17, 22, 19)" : "rgb(247, 246, 242)",
        body: expected === "dark" ? "rgb(17, 22, 19)" : "rgb(247, 246, 242)",
        scheme: expected,
        chrome: expected === "dark" ? "#111613" : "#f7f6f2",
      }, "The initial page canvas should match the theme without external CSS or JS.");
    }
    await page.close();
  }

  // Freeze real CSS timelines to inspect each stage without timing races.
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const card = document.querySelector('.project-card-animate.is-visible');
        if (!card || window.frameRevealAnimations) return;
        window.frameRevealAnimations = card.getAnimations({ subtree: true });
        for (const animation of window.frameRevealAnimations) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.route("**/emblem-scene-*.js", route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.frameRevealAnimations?.length);
    const sample = time => page.evaluate(time => {
      for (const animation of window.frameRevealAnimations) animation.currentTime = time;
      const card = document.querySelector('.project-card-animate');
      const surface = card.querySelector('.project-comet-card');
      const style = element => getComputedStyle(element);
      const rect = element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        opacity: Number(style(surface).opacity),
        x: new DOMMatrixReadOnly(style(surface).transform).m41,
        frame: rect(card.querySelector('.project-frame')),
        corners: [...card.querySelectorAll('.project-frame-corner')].map(rect),
        crossProgress: [...card.querySelectorAll('.project-frame-corner')].map(corner => ({
          vertical: [...corner.querySelectorAll('.project-cross-stroke--vertical')].map(path => parseFloat(style(path).strokeDashoffset)),
          horizontal: [...corner.querySelectorAll('.project-cross-stroke--horizontal')].map(path => parseFloat(style(path).strokeDashoffset)),
        })),
        outlineProgress: parseFloat(style(card.querySelector('.project-frame-outline rect')).strokeDashoffset),
      };
    }, time);
    const start = await sample(0);
    for (let corner = 0; corner < 4; corner++) {
      const vertical = await sample(corner * 80 + 20);
      assert.ok(vertical.crossProgress[corner].vertical.length && vertical.crossProgress[corner].vertical.every(progress => progress > 0 && progress < 1), 'Each cross should draw its vertical stroke first.');
      assert.ok(vertical.crossProgress[corner].horizontal.length && vertical.crossProgress[corner].horizontal.every(progress => progress === 1), 'The horizontal stroke must wait for the vertical stroke.');
      const horizontal = await sample(corner * 80 + 60);
      assert.ok(horizontal.crossProgress[corner].vertical.every(progress => progress === 0), 'Vertical strokes must finish before horizontal strokes.');
      assert.ok(horizontal.crossProgress[corner].horizontal.every(progress => progress > 0 && progress < 1), 'The horizontal stroke should draw second.');
      for (const [index, strokes] of horizontal.crossProgress.entries()) {
        if (index === corner) continue;
        assert.ok([...strokes.vertical, ...strokes.horizontal].every(progress => progress === (index < corner ? 0 : 1)), 'Crosses in a card must draw one at a time in clockwise order.');
      }
      assert.equal(horizontal.outlineProgress, 1, 'The outline must wait for all four crosses.');
      assert.equal(horizontal.opacity, 0, 'The card must wait for the frame.');
    }
    const outline = await sample(420);
    assert.ok(outline.crossProgress.every(strokes => [...strokes.vertical, ...strokes.horizontal].every(progress => progress === 0)), 'Crosses must finish before the outline.');
    assert.ok(outline.outlineProgress > 0 && outline.outlineProgress < 1, 'The outline should trace between the finished crosses.');
    assert.equal(outline.opacity, 0, 'The card must remain hidden until the outline finishes.');
    const slide = await sample(625);
    assert.equal(slide.outlineProgress, 0);
    assert.ok(slide.opacity > 0 && slide.opacity < 1 && slide.x < 0, 'The card should retain its left entrance after the frame finishes.');
    assert.deepEqual(slide.frame, start.frame, 'The frame must not slide with the card.');
    assert.deepEqual(slide.corners, start.corners, 'Crosses must stay fixed on their vertices throughout the reveal.');
    const end = await sample(1000);
    assert.equal(end.opacity, 1);
    assert.equal(end.x, 0);
    // Focusing a control skips the reveal, including its delayed slide.
    await page.locator('.project-expand-button').first().focus();
    assert.equal(await page.locator('.project-card-animate').first().getAttribute('data-card-reveal'), 'settled');
    assert.equal(await page.locator('.project-comet-card').first().evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...document.querySelectorAll('.project-card-animate')].every(card => card.dataset.cardReveal === 'settled'));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.project-comet-card').evaluateAll(cards => cards.some(card => getComputedStyle(card).opacity !== '1')), false,
      'Changing to reduced motion must immediately reveal even below-fold cards.');
    await page.close();
  }

  // Preserve the rendered pixels through the entrance-to-settled handoff.
  // Hold the finished entrance before its cleanup so both frames use the
  // exact final coordinates, with fonts, images, and the pointer stationary.
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    await page.addInitScript(() => {
      document.addEventListener("animationend", (event) => {
        if (event.animationName === "project-fly-in" && event.target.closest('.project-card-animate')?.dataset.cardIndex === "0") {
          event.stopImmediatePropagation();
          window.cardEntranceFinished = true;
        }
      }, true);
    });
    // The 3D scene is independent of the card's rendering handoff.
    await page.route("**/emblem-scene-*.js", route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => window.cardEntranceFinished);
    const card = page.locator('.project-card-animate').first();
    await card.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await card.scrollIntoViewIfNeeded();
    // The fixed scroll cue can overlap a mobile card. Hold its independent
    // gesture still while comparing the card's entrance and settled pixels.
    await page.locator('[data-projects-scroll-arrow]').evaluate(button => {
      for (const animation of button.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    const before = await card.screenshot();
    await card.evaluate(element => { element.dataset.cardReveal = "settled"; });
    const after = await card.screenshot();
    const beforePixels = await sharp(before).raw().toBuffer();
    const afterPixels = await sharp(after).raw().toBuffer();
    assert.ok(beforePixels.equals(afterPixels),
      `Card contents changed visually after their entrance at ${width}px.`);
    await page.close();
  }

  // Initial cards still fly in when the emblem module is slow.
  // These scenarios require two initially visible cards after row snapping.
  const loadingPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await loadingPage.addInitScript(() => {
    window.initialCardAnimations = 0;
    window.contentEntrances = [];
    document.addEventListener("animationstart", (event) => {
      if (event.animationName === "project-fly-in" && Number(event.target.closest('.project-card-animate')?.dataset.cardIndex) < 2) {
        window.initialCardAnimations++;
      }
      if (event.animationName === "content-rise-in") {
        window.contentEntrances.push(event.target.className);
      }
    });
  });
  await loadingPage.route("**/emblem-scene-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await loadingPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await loadingPage.waitForFunction(() => document.querySelector("[data-emblem-stage]").dataset.modelState === "loading");
  assert.equal(await loadingPage.locator('.emblem-stage img, [data-emblem-fallback], [data-emblem-status], .status-spinner').count(), 0,
    "The empty model stage should have no loading icon or indicator.");
  assert.equal(await loadingPage.locator('#emblem-canvas').evaluate((canvas) => getComputedStyle(canvas).opacity), "0");
  await loadingPage.waitForFunction(() => window.initialCardAnimations >= 2);
  await loadingPage.waitForFunction(() => [...document.querySelectorAll('.project-card-animate')]
    .slice(0, 2).every((card) => card.dataset.cardReveal === 'settled'));
  await loadingPage.locator('[data-emblem-stage][data-rendered="true"]').waitFor();
  assert.equal(await loadingPage.evaluate(() => window.initialCardAnimations), 2,
    "Each initially visible card should animate once.");
  assert.ok(await loadingPage.evaluate(() =>
    window.contentEntrances.some((name) => name.includes('site-header'))
      && window.contentEntrances.some((name) => name.includes('hero-copy'))),
    "The header and hero copy should enter on page load.");
  assert.equal(await loadingPage.locator('.site-footer').getAttribute('data-content-reveal'), 'pending');
  await loadingPage.locator('.site-footer').scrollIntoViewIfNeeded();
  await loadingPage.waitForFunction(() => document.querySelector('.site-footer')?.dataset.contentReveal === 'visible');
  await loadingPage.close();

  // A late model can prepare during a slide, but should appear after it settles.
  for (const modelDelay of [900, 1400]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      window.revealOverlaps = [];
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.attributeName !== "data-rendered" || record.target.dataset.rendered !== "true") continue;
          const running = [...document.querySelectorAll(".project-card-animate")]
            .flatMap(card => card.getAnimations({ subtree: true }))
            .filter(animation => animation.playState === "running");
          window.revealOverlaps.push(running.length);
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-rendered"] });
    });
    await page.route("**/emblem-scene-*.js", async route => {
      await new Promise(resolve => setTimeout(resolve, modelDelay));
      await route.continue();
    });
    for (const refresh of [false, true]) {
      if (refresh) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.locator('[data-emblem-stage][data-rendered="true"]').waitFor();
      assert.deepEqual(await page.evaluate(() => window.revealOverlaps), [0],
        "The model appeared before an active card entrance settled.");
      await page.waitForFunction(() => document.querySelector('.project-card-animate')?.dataset.cardReveal === 'settled');
      assert.equal(await page.locator('.project-card-animate').first().getAttribute("data-card-reveal"), "settled",
        "Finished entrances should settle without replaying their animation.");
    }
    await page.close();
  }

  // Delayed React still hydrates the same static cards; below-fold cards reveal on scroll.
  for (const islandDelay of [900, 2000]) {
    const reloadPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await reloadPage.addInitScript(() => {
      window.cardEntranceStarts = [];
      window.animatedCards = new Map();
      document.addEventListener("DOMContentLoaded", () => {
        window.initialCard = document.querySelector('.project-card-animate[data-card-index="0"]');
      });
      document.addEventListener("animationstart", (event) => {
        const card = event.target.closest('.project-card-animate');
        if (event.animationName === "project-fly-in" && card) {
          window.cardEntranceStarts.push(card.dataset.cardIndex);
          if (!window.animatedCards.has(card.dataset.cardIndex)) {
            window.animatedCards.set(card.dataset.cardIndex, card);
          }
        }
      });
    });
    await reloadPage.route("**/projects-island-*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, islandDelay));
      await route.continue();
    });
    await reloadPage.goto(baseUrl, { waitUntil: "networkidle" });
    await reloadPage.locator('#projects-root[data-interactive="true"]').waitFor();
    await reloadPage.waitForFunction(() => [...document.querySelectorAll('.project-card-animate')]
      .slice(0, 2).every(card => card.dataset.cardReveal === 'settled'));
    assert.ok(await reloadPage.evaluate(() => window.initialCard?.isConnected),
      "React replaced the initial static card during hydration.");
    assert.deepEqual(await reloadPage.locator('.project-card-animate').evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => card.dataset.cardReveal)), ['settled', 'settled']);
    for (let index = 0; index < 5; index++) {
      await reloadPage.locator('.project-card-animate').nth(index).scrollIntoViewIfNeeded();
      await reloadPage.waitForFunction((cardIndex) =>
        document.querySelector(`.project-card-animate[data-card-index="${cardIndex}"]`)?.dataset.cardReveal === 'settled', index);
    }
    const starts = await reloadPage.evaluate(() => window.cardEntranceStarts);
    for (let index = 0; index < 5; index++) {
      assert.ok(starts.includes(String(index)), `Card ${index} never animated.`);
      assert.equal(starts.filter((card) => card === String(index)).length, 1,
        `Card ${index} replayed a completed entrance.`);
    }
    assert.ok(await reloadPage.evaluate(() => [...window.animatedCards.values()].every(card => card.isConnected)),
      "React replaced a card during its scroll entrance.");
    await reloadPage.close();
  }

  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const directions = await page.locator('.project-card-animate').evaluateAll(cards => cards.map(card => ({
      direction: card.dataset.direction,
      travel: parseFloat(getComputedStyle(card).getPropertyValue('--fly-x')),
    })));
    assert.deepEqual(directions, Array.from({ length: 5 }, (_, index) => ({
      direction: index % 2 === 0 ? 'left' : 'right',
      travel: (index % 2 === 0 ? -1 : 1) * (width <= 640 ? 44 : 80),
    })), 'Project cards should alternate left and right travel.');
    await page.locator('[data-emblem-stage][data-model-state="ready"]').waitFor();
    const card = page.locator('[data-project="doorlink"]');
    const button = page.locator('[data-project="doorlink"] .project-expand-button');
    await card.scrollIntoViewIfNeeded();
    const frame = page.locator('.project-frame').first();
    // Hover may scroll the control into view while its entrance settles.
    // Sample the resting viewport coordinates after that setup completes.
    await button.hover();
    const frameBounds = await frame.boundingBox();
    assert.ok(frameBounds, "The project card has no fixed frame.");
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
    assert.deepEqual(await frame.boundingBox(), frameBounds,
      "The blueprint frame must stay attached to the grid while its card tilts.");
    const hoverBackground = frame.locator('.project-hover-background');
    assert.equal(await hoverBackground.count(), 1, "Hovering a card should reveal its shared highlight.");
    const highlightBounds = await hoverBackground.boundingBox();
    assert.ok(Math.abs(highlightBounds.x - frameBounds.x) < 0.75
      && Math.abs(highlightBounds.width - frameBounds.width) < 0.75
      && Math.abs(highlightBounds.y - frameBounds.y) < 0.75
      && Math.abs(highlightBounds.height - frameBounds.height) < 0.75,
      "The hover highlight must fit inside the calibrated frame.");
    assert.equal(await card.evaluate(element => getComputedStyle(element).cursor), 'pointer',
      "The clickable card surface should use a hand cursor.");
    assert.equal(await card.locator('.project-box-summary').evaluate(element => getComputedStyle(element).cursor), 'text',
      "Descriptions should retain the text-selection cursor.");
    await card.locator('.project-box-summary').click();
    assert.equal(await page.getByRole('dialog').count(), 0,
      "Clicking selectable description text should not expand the card.");
    assert.ok(!secondTransform.includes('scale'), "The Comet Card should not scale up on hover.");
    assert.equal(
      await page.locator('.project-comet-card').first().locator('.comet-glare').evaluate((element) => getComputedStyle(element).opacity),
      "1",
      "The subtle Comet glare did not appear on hover.",
    );
    // Hit-test beyond the resting surface edges to catch clipping during tilt.
    const restingBounds = await page.locator('.project-comet-card').first().boundingBox();
    assert.ok(restingBounds, "The Comet wrapper has no rendered bounds.");
    for (const side of ["left", "right"]) {
      await page.mouse.move(
        side === "left" ? restingBounds.x + 20 : restingBounds.x + restingBounds.width - 20,
        restingBounds.y + restingBounds.height / 2,
      );
      await page.waitForTimeout(500);
      const edgeVisible = await card.evaluate((element, side) => {
        const resting = element.closest('.project-comet-card').getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const x = side === "left" ? resting.left - 1 : resting.right + 1;
        return document.elementFromPoint(x, rect.top + rect.height / 2)?.closest('[data-project]') === element;
      }, side);
      assert.ok(edgeVisible, `The tilted card is clipped at the ${side} surface boundary at ${width}px.`);
    }
    // Pointer extremes must fit within the calibrated frame, without clipping
    // away the card's tilted edges or moving the frame itself.
    for (const [x, y] of [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98]]) {
      await page.mouse.move(restingBounds.x + restingBounds.width * x, restingBounds.y + restingBounds.height * y);
      await page.waitForTimeout(400);
      const tilted = await card.boundingBox();
      const currentFrame = await frame.boundingBox();
      assert.ok(tilted.x >= currentFrame.x - 0.75 && tilted.y >= currentFrame.y - 0.75
        && tilted.x + tilted.width <= currentFrame.x + currentFrame.width + 0.75
        && tilted.y + tilted.height <= currentFrame.y + currentFrame.height + 0.75,
      `The tilted surface escaped its frame at ${width}px (${x}, ${y}).`);
    }
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
      const source = document.querySelector('[data-project="doorlink"]').getBoundingClientRect();
      const start = performance.now();
      document.querySelector('[data-project="doorlink"] .project-expand-button').click();
      while (performance.now() - start < 1200) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const dialog = document.querySelector('[role="dialog"]');
        const rect = dialog?.getBoundingClientRect();
        samples.push({ t: performance.now() - start, x: rect?.x, y: rect?.y, width: rect?.width, height: rect?.height });
      }
      const final = samples.at(-1);
      const dimension = Math.abs(source.width - final.width) > 80 ? 'width' : 'height';
      const distance = Math.abs(source[dimension] - final[dimension]);
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
        morphsFromCard: samples.some(sample => sample.t < 100
          && Math.abs(sample[dimension] - source[dimension]) < distance * 0.5),
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
    assert.equal(result.morphsFromCard, true,
      "The expanded view must morph from the original card's dimensions.");
    assert.equal(await page.locator('[data-projects-scroll-arrow]').isVisible(), false,
      "The page scroll cue should be hidden while the project dialog is open.");
    const backgroundScrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(width - 4, 100);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.scrollY), backgroundScrollBefore,
      "The background page scrolled while the project dialog was open.");
    const dialogScroll = page.locator('.project-dialog-scroll');
    assert.ok(await dialogScroll.evaluate(element => element.scrollHeight > element.clientHeight),
      "Long project details must remain scrollable inside the dialog.");
    await dialogScroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.waitForTimeout(100);
    assert.equal(await card.evaluate(element => getComputedStyle(element.closest('.project-comet-card')).opacity), '0',
      "The original card must stay hidden while the expanded view is scrolled.");
    assert.equal(await frame.evaluate(element => element.inert), true,
      "The hidden source card must not receive keyboard focus.");
    assert.equal(await page.locator('.project-hover-background').count(), 0,
      "Expanded projects should not leave a hover highlight behind the dialog.");
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await card.evaluate(element => getComputedStyle(element.closest('.project-comet-card')).opacity), '1',
      "Closing the expanded view should restore the original card.");
    assert.equal(await frame.evaluate(element => element.inert), false);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '',
      "Closing the dialog should restore page scrolling.");
    console.log(`${width}px: visible in ${result.firstMs.toFixed(0)} ms, settled in ${result.settledMs.toFixed(0)} ms`);
    await page.close();
  }

  const galleryPage = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await galleryPage.goto(baseUrl, { waitUntil: "networkidle" });
  await galleryPage.locator('#projects-root[data-interactive="true"]').waitFor();
  for (const [projectId, imagePaths] of [
    ["doorlink", ["/projects/doorlink-enclosure.jpg", "/projects/doorlink-pcb.jpg", "/projects/doorlink-wiring.webp", "/projects/doorlink-pcb-3d.png", "/projects/doorlink-pcb-layout.png"]],
    ["linewatch", ["/projects/linewatch-onboarding-map.png", "/projects/linewatch-onboarding-impact.png", "/projects/linewatch-onboarding-personal.png", "/projects/linewatch-onboarding-stations.png"]],
    ["file-sync", ["/projects/filesync-history.png", "/projects/filesync-folders.png", "/projects/filesync-conflicts.png"]],
    ["courtload", ["/projects/courtload-comparison.png", "/projects/courtload-evaluation.png"]],
    ["medical-imaging", ["/projects/medical-imaging/stage-viewer.png", "/projects/medical-imaging/export-benchmark.svg"]],
  ]) {
    const preview = galleryPage.locator(`[data-project="${projectId}"] .project-card-preview`);
    assert.equal(await preview.locator('img').getAttribute('src'), imagePaths[0]);
    assert.match(await preview.getAttribute('aria-label'), new RegExp(`View ${imagePaths.length} Images`));
    assert.match(await preview.innerText(), new RegExp(`${imagePaths.length} Images`));
    await preview.focus();
    await galleryPage.keyboard.press('Enter');
    const dialog = galleryPage.getByRole("dialog");
    const image = dialog.locator(".project-gallery-stage img");
    const thumbnails = dialog.locator('.project-gallery-thumbnail');
    await thumbnails.first().waitFor();
    assert.equal(await thumbnails.count(), imagePaths.length);
    const previousImage = dialog.getByRole("button", { name: "Previous image", exact: true });
    const nextImage = dialog.getByRole("button", { name: "Next image", exact: true });
    assert.equal(await previousImage.isVisible(), true);
    assert.equal(await nextImage.isVisible(), true);
    await previousImage.click();
    assert.equal(await image.getAttribute("src"), imagePaths.at(-1), "Previous must wrap to the final photo.");
    assert.equal(await thumbnails.last().getAttribute("aria-pressed"), "true");
    assert.equal(await dialog.locator(".project-gallery-heading span").innerText(), `${imagePaths.length} / ${imagePaths.length}`);
    await nextImage.click();
    assert.equal(await image.getAttribute("src"), imagePaths[0], "Next must wrap to the first photo.");
    assert.equal(await dialog.getByRole("link", { name: "View full image" }).getAttribute("href"), imagePaths[0]);
    await nextImage.focus();
    await nextImage.press("ArrowRight");
    assert.equal(await image.getAttribute("src"), imagePaths[1], "The right arrow key must advance the gallery.");
    await nextImage.press("ArrowLeft");
    assert.equal(await image.getAttribute("src"), imagePaths[0], "The left arrow key must reverse the gallery.");
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
      assert.equal(await preview.evaluate(element => getComputedStyle(element.closest('.project-comet-card')).opacity), '0',
        "Gallery changes must not reveal the original card behind the dialog.");
    }
    const projectLinks = dialog.locator(".project-dialog-link");
    const expectedLinkCount = ["file-sync", "courtload"].includes(projectId) ? 0 : ["linewatch", "medical-imaging"].includes(projectId) ? 2 : 1;
    assert.equal(await projectLinks.count(), expectedLinkCount, `${projectId} should only show available public destinations.`);
    if (projectId === "medical-imaging") {
      const demo = dialog.getByRole("link", { name: /^Watch Demo:/ });
      assert.equal(await demo.getAttribute("href"), "https://github.com/calebhabesh/NM03-Capstone-Project#demo");
      assert.equal(await demo.getAttribute("target"), "_blank");
      assert.equal(await demo.innerText(), "Watch Demo", "The native recording should be labeled as a demo.");
    }
    for (const link of await projectLinks.all()) {
      assert.doesNotMatch(await link.innerText(), /↗/);
    }
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await dialog.waitFor({ state: "detached" });
    assert.ok(await preview.evaluate((element) => element === document.activeElement), "Closing the gallery should return focus to its preview.");
  }
  await galleryPage.close();

  const reducedPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await reducedPage.locator('.hero-copy').evaluate((element) => getComputedStyle(element).opacity), '1');
  assert.equal(await reducedPage.locator('.site-footer').getAttribute('data-content-reveal'), null,
    "Reduced-motion visits should not hide the footer for an entrance animation.");
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
    "The card moved despite a reduced-motion preference.",
  );
  await reducedPage.mouse.move(0, 0);
  await reducedCard.locator('.project-expand-button').focus();
  await reducedPage.locator('.project-frame').first().locator('.project-hover-background').waitFor();
  assert.equal(await reducedPage.locator('.project-hover-background').evaluate(element => getComputedStyle(element).opacity), '1',
    "Keyboard focus should show the highlight immediately with reduced motion.");
  await reducedPage.close();
} finally {
  await browser?.close();
  server.kill();
}
