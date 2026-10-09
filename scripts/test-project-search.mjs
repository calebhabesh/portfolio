import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const port = await new Promise(resolve => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", ...(process.env.PORTFOLIO_TEST_MODE === "dev" ? [] : ["preview"]), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url), stdio: "ignore",
});
let browser;

async function visibleIds(page) {
  return page.locator('.project-card-animate:not([hidden]):not([data-search-match="false"]) [data-project]')
    .evaluateAll(cards => cards.map(card => card.dataset.project));
}

async function settled(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".project-card-animate")].every(slot => {
    const article = slot.querySelector("[data-project]");
    const content = slot.querySelector(".project-slot-content, .project-search-empty");
    return article?.dataset.project === slot.dataset.resultId && (!content || Number(getComputedStyle(content).opacity) >= 0.999);
  }));
  await page.waitForFunction(() => [...document.querySelectorAll(".project-card-animate")]
    .every(card => !card.getAnimations({ subtree: true }).some(animation => animation.playState === "running")));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Let the grid's mutation/resize measurements settle after result swaps.
  await page.waitForFunction(() => {
    const geometry = JSON.stringify([...document.querySelectorAll(".project-frame")].map(frame => {
      const rect = frame.getBoundingClientRect();
      return [rect.top + scrollY, rect.left, rect.width, rect.height];
    }));
    const previous = window.searchSettledGeometry;
    const count = previous?.geometry === geometry ? previous.count + 1 : 0;
    window.searchSettledGeometry = { geometry, count };
    return count >= 3;
  }, null, { polling: "raf" });
}

async function frameGeometry(page) {
  return page.locator(".project-frame").evaluateAll(frames => frames.map(frame => {
    const rect = frame.getBoundingClientRect();
    return { top: rect.top + scrollY, left: rect.left, width: rect.width, height: rect.height };
  }));
}

async function checkStableFrames(page, original) {
  const current = await frameGeometry(page);
  const query = await page.getByRole("searchbox", { name: "Search technologies" }).inputValue();
  assert.equal(current.length, original.length);
  current.forEach((frame, index) => {
    for (const key of ["top", "left", "width", "height"]) {
      assert.ok(Math.abs(frame[key] - original[index][key]) < 0.05,
        `Filtering moved frame ${index}'s ${key} from ${original[index][key]} to ${frame[key]} for ${query}.`);
    }
  });
}

async function checkGrid(page) {
  const geometry = await page.locator('.project-card-animate:not([hidden]) .project-frame').evaluateAll(frames => {
    const root = document.documentElement.style;
    return {
      unit: parseFloat(root.getPropertyValue("--grid-unit")),
      origin: parseFloat(root.getPropertyValue("--grid-origin-x")),
      corners: frames.flatMap(frame => [...frame.querySelectorAll(".project-frame-corner")].map(corner => {
        const box = corner.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 + window.scrollY };
      })),
      footerInsets: frames.filter(frame => frame.querySelector(".project-box")).map(frame => {
        const surface = frame.querySelector(".project-box").getBoundingClientRect();
        const content = frame.querySelector(".project-box-inner");
        const footer = content.querySelector(".project-details-button").getBoundingClientRect();
        return { actual: surface.bottom - footer.bottom, expected: parseFloat(getComputedStyle(content).paddingBottom) };
      }),
    };
  });
  for (const { x, y } of geometry.corners) {
    assert.ok(Math.abs(y - Math.round(y / geometry.unit) * geometry.unit) < 0.8, `Filtered frame left its grid row: ${y}`);
    assert.ok(Math.abs(x - geometry.origin - Math.round((x - geometry.origin) / geometry.unit) * geometry.unit) < 0.8,
      `Filtered frame left its grid column: ${x}`);
  }
  for (const { actual, expected } of geometry.footerInsets) {
    assert.ok(Math.abs(actual - expected) < 0.8, "Filtering must keep the details button inside its card with the usual bottom padding.");
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
    "Search must not create horizontal overflow.");
}

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const { width, theme, reducedMotion } of [
    { width: 1440, theme: "light", reducedMotion: "no-preference" },
    { width: 2048, theme: "dark", reducedMotion: "no-preference" },
    { width: 375, theme: "dark", reducedMotion: "no-preference" },
    { width: 320, theme: "light", reducedMotion: "reduce" },
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
    // Keep the independent headshot island out of project hydration checks.
    await page.route(/\/headshot-island(?:-[^/]+)?\.(?:js|tsx)(?:\?.*)?$/, route =>
      route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    const search = page.getByRole("searchbox", { name: "Search technologies" });
    await search.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await settled(page);
    await page.evaluate(() => { window.searchOriginalCards = [...document.querySelectorAll(".project-card-animate")]; });
    const originalGeometry = await frameGeometry(page);
    const hasMaze = await page.locator(".gutter-maze-course").count() > 0;
    const mazeSnapshot = () => page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => ({ seed: course.dataset.seed, expanded: Number(course.dataset.expanded) })));
    const originalMaze = await mazeSnapshot();
    const originalMazeRound = hasMaze ? Number(await page.locator("#gutter-mazes-root").getAttribute("data-round")) : 0;
    const originalHeight = await page.evaluate(() => document.body.getBoundingClientRect().height);
    const originalBadges = await page.locator(".project-card-animate .project-box-tags").allTextContents();

    for (const [query, ids] of [
      ["J", ["doorlink", "linewatch", "portfolio-site"]],
      ["Ja", ["doorlink", "linewatch", "portfolio-site"]],
      ["Java", ["doorlink", "linewatch", "portfolio-site"]],
      ["Mos", ["doorlink"]],
      ["React", ["doorlink", "linewatch", "orbit", "courtlens", "portfolio-site"]],
      ["React, PostgreSQL", ["doorlink", "linewatch", "courtlens"]],
      ["OCI", ["linewatch"]],
      ["Pyhton", ["courtlens"]],
      ["C", ["doorlink"]],
      ["C++", ["doorlink", "medical-imaging", "systemc-noc"]],
      ["CMake", ["medical-imaging", "systemc-noc"]],
      ["AWS", ["linewatch"]],
      ["post", ["doorlink", "linewatch", "courtlens"]],
    ]) {
      await search.fill(query);
      await settled(page);
      assert.deepEqual(await visibleIds(page), ids, `Wrong cards for ${query} at ${width}px`);
      assert.equal(await page.locator(".project-frame > .project-frame-guides").evaluateAll(guides =>
        guides.filter(guide => Number(getComputedStyle(guide).opacity) >= 0.999).length), ids.length,
      "Only matching results should have full-strength frame outlines and crosses.");
      assert.ok(await page.locator('.project-card-animate[data-search-match="false"] .project-frame-guides').evaluateAll(guides =>
        guides.every(guide => {
          const style = getComputedStyle(guide);
          return style.visibility === "visible" && Math.abs(Number(style.opacity) - 0.12) < 0.001;
        })), "Unmatched frames should stay faintly visible.");
      assert.equal(await page.locator('.project-search [role="status"]').textContent(), `${ids.length} of 8 projects`);
      for (const id of ids) {
        assert.ok(await page.locator(`[data-project="${id}"] .project-box-tags mark`).count(), `${id} lacks visible match evidence.`);
      }
      if (query === "J" || query === "Ja" || query === "Java") {
        assert.equal(await page.locator('[data-project="doorlink"] mark').innerText(), query);
        const matches = await page.locator(".project-box-tags mark").evaluateAll(marks => marks.map(mark => {
          const style = getComputedStyle(mark);
          const badgeStyle = getComputedStyle(mark.parentElement);
          return {
            background: style.backgroundColor,
            weight: Number(style.fontWeight),
            color: style.color,
            badgeColor: badgeStyle.color,
            outline: badgeStyle.boxShadow,
          };
        }));
        for (const match of matches) {
          assert.equal(match.background, "rgba(0, 0, 0, 0)", "Search matches must have no background highlight.");
          assert.ok(match.weight >= 700, "Search matches must use bold text.");
          assert.notEqual(match.color, match.badgeColor, "Search matches must use an accent text color.");
          assert.notEqual(match.outline, "none", "Matching badges must retain their outline.");
        }
        if (query === "J") {
          const accessibility = await new AxeBuilder({ page }).include("#projects-root").analyze();
          assert.deepEqual(accessibility.violations, [], "Active search matches have accessibility violations.");
        }
      }
      if (query === "post") assert.equal(await page.locator('[data-project="doorlink"] mark').innerText(), "Post");
      if (query === "AWS") assert.match(await page.locator('[data-project="linewatch"] .project-box-tags').innerText(), /AWS \(Lab\)/);
      if (query === "J" || query === "Mos" || query === "React") {
        await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
        await page.screenshot({ path: `.artifacts/search-${query.toLowerCase()}-${width}-${theme}.png`, fullPage: true });
      }
      if (reducedMotion === "reduce") assert.equal(await page.locator(".project-card-animate").evaluateAll(cards =>
        cards.flatMap(card => card.getAnimations()).filter(animation => animation.playState === "running").length), 0);
      await checkGrid(page);
      await checkStableFrames(page, originalGeometry);
      assert.ok(Math.abs(await page.evaluate(() => document.body.getBoundingClientRect().height) - originalHeight) < 0.05, "Search must keep the maze's document height stable.");
    }

    await search.fill("OCI");
    await settled(page);
    await page.locator('[data-project="linewatch"] .project-details-button').click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.locator(".project-box-tags mark").innerText(), "Oracle Cloud Infrastructure");
    assert.deepEqual(await dialog.locator(".project-evidence mark").allTextContents(), ["Oracle Cloud Infrastructure", "OCI", "OCI"]);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.locator('[data-project="linewatch"] .project-details-button').evaluate(button => button === document.activeElement), true);

    // Finish rapid edits while previous exits and moves are still in flight.
    for (const query of ["React", "impossible-stack", "CMake", "Go", "React, SQLite", "post"]) await search.fill(query);
    await settled(page);
    assert.deepEqual(await visibleIds(page), ["doorlink", "linewatch", "courtlens"]);
    await checkGrid(page);
    await search.fill("Rust");
    await settled(page);
    assert.deepEqual(await visibleIds(page), []);
    assert.equal(await page.locator(".project-frame > .project-frame-guides").evaluateAll(guides =>
      guides.filter(guide => Number(getComputedStyle(guide).opacity) >= 0.999).length), 1,
    "Only the empty-state frame should remain at full strength when nothing matches.");
    const empty = page.locator(".project-search-empty");
    assert.equal(await empty.locator(".project-search-empty-title").innerText(), "No matching projects.");
    assert.equal(await empty.locator("p").last().textContent(), "Try another technology, or browse my GitHub");
    assert.equal(await empty.locator("a").getAttribute("href"), "https://github.com/calebhabesh");
    assert.match(await empty.locator("a").evaluate(link => getComputedStyle(link).textDecorationLine), /underline/);
    const emptyGeometry = await empty.boundingBox();
    const topFrame = await page.locator(".project-frame").first().boundingBox();
    assert.ok(Math.abs(emptyGeometry.y + emptyGeometry.height / 2 - topFrame.y - topFrame.height / 2) < 1, "The empty state belongs at the center of the top frame.");
    assert.equal(await page.locator("[data-projects-scroll-arrow]").evaluate(arrow => arrow.classList.contains("is-hidden")), true);
    await page.getByRole("button", { name: "Clear technology search", exact: true }).click();
    await settled(page);
    assert.equal(await search.evaluate(input => input === document.activeElement), true);
    assert.equal((await visibleIds(page)).length, 8);
    assert.equal(await page.locator(".project-frame > .project-frame-guides").evaluateAll(guides =>
      guides.filter(guide => Number(getComputedStyle(guide).opacity) >= 0.999).length), 8);
    assert.deepEqual(await page.locator(".project-card-animate .project-box-tags").allTextContents(), originalBadges);
    assert.equal(await page.locator(".project-card-animate mark").count(), 0);
    assert.equal(await page.evaluate(() => window.searchOriginalCards.every((card, i) => card === document.querySelectorAll(".project-card-animate")[i])), true,
      "Filtering must preserve the original card shells.");
    await search.fill("React");
    await settled(page);
    // Search before visiting the lower cards, then scroll through those slots.
    await page.locator(".project-frame").last().scrollIntoViewIfNeeded();
    assert.equal(await page.locator(".project-card-animate").evaluateAll(cards => cards.every(card => card.dataset.cardReveal === "settled")), true);
    assert.equal(await page.locator(".project-frame-corner path, .project-frame-outline rect").evaluateAll(strokes => strokes.every(stroke => parseFloat(getComputedStyle(stroke).strokeDashoffset) === 0)), true, "Search must leave the crosses and outlines drawn when scrolling.");
    await checkStableFrames(page, originalGeometry);
    if (hasMaze) {
      const currentMaze = await mazeSnapshot();
      const currentRound = Number(await page.locator("#gutter-mazes-root").getAttribute("data-round"));
      // The maze starts a fresh seed after solving a round. A longer browser
      // check can span that normal cycle, while filtering keeps its size fixed.
      if (currentRound === originalMazeRound) {
        assert.deepEqual(currentMaze.map(course => course.seed), originalMaze.map(course => course.seed), "Filtering and scrolling must preserve the running maze.");
        assert.ok(currentMaze.every((course, index) => course.expanded > originalMaze[index].expanded), "A* must continue advancing while filtering and scrolling.");
      } else {
        assert.ok(currentRound > originalMazeRound, "The maze should continue into subsequent rounds.");
      }
    }
    await search.press("Escape");
    await settled(page);
    assert.equal(await search.inputValue(), "");
    await checkGrid(page);
    const accessibility = await new AxeBuilder({ page }).include("#projects-root").analyze();
    assert.deepEqual(accessibility.violations, [], "Project search has accessibility violations.");
    // The expected abort only isolates this check from the independent 3D scene.
    assert.deepEqual(errors.filter(error => !/emblem|Failed to fetch dynamically imported module|ERR_FAILED/.test(error)), [], "Search produced browser or hydration errors.");
    await context.close();
    console.log(`Project search passed at ${width}px (${theme}, ${reducedMotion}).`);
  }
} finally {
  await browser?.close();
  server.kill();
}
