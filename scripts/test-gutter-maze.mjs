import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import { createMazeSearch, generateMaze } from "../src/maze-pathfinding.js";
import { mkdir } from "node:fs/promises";

const port = await new Promise(resolve => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url), stdio: "ignore",
});
let browser;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.15,
  `${label}: ${actual} vs ${expected}`);
const paintCount = page => page.evaluate(() => window.mazeProbe.paints);
const exploredCells = page => page.evaluate(() => Object.fromEntries(Object.entries(window.mazeProbe.last)
  .map(([side, fills]) => [side, fills.map(({ x, y }) => ({ x, y }))])));

async function checkGeometry(page, visible) {
  const geometry = await page.evaluate(() => {
    const rect = element => {
      const { left, right, top, height } = element.getBoundingClientRect();
      return { left, right, top, height };
    };
    return {
      unit: parseFloat(document.documentElement.style.getPropertyValue("--grid-unit")),
      width: document.documentElement.clientWidth, height: innerHeight,
      scroll: scrollY, pageHeight: Math.max(innerHeight, Math.ceil(document.body.getBoundingClientRect().height)),
      scrollHeight: document.documentElement.scrollHeight,
      shell: rect(document.querySelector(".page-shell")),
      vertices: [...document.querySelectorAll(".gutter-maze-walls")].flatMap(svg => {
        const points = [...svg.querySelector("path").getAttribute("d").matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)];
        return points.filter((_, index) => index % 5 === 0 || index % 5 === 4).map(point => {
          const screen = new DOMPoint(Number(point[1]), Number(point[2])).matrixTransform(svg.getScreenCTM());
          return { x: screen.x, y: screen.y };
        });
      }),
      drawings: [...document.querySelectorAll(".gutter-maze-walls, .gutter-maze-search")].map(element => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      }),
      courses: [...document.querySelectorAll(".gutter-maze-course")].map(rect),
    };
  });
  assert.equal(geometry.courses.length, visible ? 2 : 0, "Show both courses only when both gutters are wide enough.");
  if (!visible) return;
  for (const point of geometry.vertices) {
    near(point.x, Math.round(point.x / geometry.unit) * geometry.unit, "Maze vertices must meet background columns");
    near(point.y + geometry.scroll, Math.round((point.y + geometry.scroll) / geometry.unit) * geometry.unit,
      "Maze vertices must stay on document grid rows while the page scrolls");
  }
  for (const drawing of geometry.drawings) {
    near(drawing.top + geometry.scroll, 0, "Maze walls and search fills must start at the document top");
    assert.ok(drawing.bottom + geometry.scroll >= geometry.pageHeight - 0.15,
      "Wall and fill layers must reach the bottom of the scrollable page.");
  }
  const [left, right] = geometry.courses;
  near(left.left, geometry.unit, "Left course needs one full cell at the screen edge");
  near(geometry.shell.left - left.right, geometry.unit, "Left course needs one full cell before content");
  near(right.left - geometry.shell.right, geometry.unit, "Right course needs one full cell after content");
  near(geometry.width - right.right, geometry.unit, "Right course needs one full cell at the screen edge");
  for (const course of geometry.courses) {
    near(course.top + geometry.scroll, 0, "Course starts at document y=0");
    near(course.height, geometry.pageHeight, "Course reaches the page bottom");
    near(course.left, Math.round(course.left / geometry.unit) * geometry.unit, "Walls share the global grid columns");
  }
  assert.ok(Math.abs(geometry.scrollHeight - geometry.pageHeight) <= 1,
    "The maze must not add extra scrollable height beyond the content.");
}

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 2048, height: 1167 }, colorScheme: theme,
      reducedMotion: "reduce", deviceScaleFactor: theme === "dark" ? 2 : 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/emblem-scene-*.js", route => route.abort());
    await page.addInitScript(() => {
      window.mazeProbe = { paints: 0, redraws: 0, text: 0, strokes: 0, fills: [], reveals: [], frames: [], currentFrames: {}, last: {}, results: [], rounds: [] };
      const revealedCells = new Set();
      const getRandomValues = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = array => {
        if (array instanceof Uint32Array && array.length === 1) { array[0] = 42; return array; }
        return getRandomValues(array);
      };
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        if (this.canvas.classList.contains("gutter-maze-search")) window.mazeProbe.text++;
        return fillText.apply(this, args);
      };
      new MutationObserver(records => {
        const root = document.querySelector("#gutter-mazes-root");
        if (!root) return;
        if (records.some(record => record.attributeName === "data-outcome")) {
          window.mazeProbe.results.push({ at: performance.now(), round: root.dataset.round,
            courses: [...root.children].map(course => ({ side: course.dataset.side,
              outcome: course.dataset.outcome, length: Number(course.dataset.pathLength),
              expanded: Number(course.dataset.expanded), seed: Number(course.dataset.seed),
              columns: Number(course.dataset.columns), rows: Number(course.dataset.rows),
              start: Number(course.dataset.start), goal: Number(course.dataset.goal),
              path: course.querySelector(".gutter-maze-solution").getAttribute("d"),
              pathAnimation: getComputedStyle(course.querySelector(".gutter-maze-solution")).animationName,
              pathFill: getComputedStyle(course.querySelector(".gutter-maze-solution")).fill,
              pathStroke: getComputedStyle(course.querySelector(".gutter-maze-solution")).stroke,
              walls: course.querySelector("path").getAttribute("d"),
              animation: getComputedStyle(course.querySelector("svg")).animationName })) });
        }
        if (records.some(record => record.target === root && record.attributeName === "data-round")) {
          window.mazeProbe.rounds.push({ at: performance.now(), round: root.dataset.round });
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-outcome", "data-round"] });
      const stroke = CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (this.canvas.classList.contains("gutter-maze-search")) window.mazeProbe.strokes++;
        return stroke.apply(this, args);
      };
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.classList.contains("gutter-maze-search")) {
          window.mazeProbe.redraws++;
          const side = this.canvas.parentElement.dataset.side;
          window.mazeProbe.last[side] = [];
          const root = this.canvas.closest("#gutter-mazes-root");
          const unit = this.canvas.parentElement.querySelector("svg").viewBox.baseVal.width / Number(this.canvas.parentElement.dataset.columns);
          const frame = { at: performance.now(), round: root.dataset.round, state: root.dataset.state, side, unit, highlights: [], frontiers: [] };
          window.mazeProbe.frames.push(frame);
          window.mazeProbe.currentFrames[side] = frame;
          window.mazeProbe.activeColor ??= getComputedStyle(document.documentElement).getPropertyValue("--maze-path-fill").trim();
          window.mazeProbe.frontierColor ??= getComputedStyle(document.documentElement).getPropertyValue("--maze-frontier").trim();
        }
        return clear.apply(this, args);
      };
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
        if (this.canvas.classList.contains("gutter-maze-search")) {
          window.mazeProbe.paints++;
          window.mazeProbe.last[this.canvas.parentElement.dataset.side].push({
            x, y, width, height, opacity: this.globalAlpha, color: this.fillStyle,
          });
          const side = this.canvas.parentElement.dataset.side;
          window.mazeProbe.fills.push({
            side, x, y, unit: window.mazeProbe.currentFrames[side].unit, opacity: this.globalAlpha, color: this.fillStyle,
          });
          if (this.fillStyle === window.mazeProbe.activeColor) {
            window.mazeProbe.currentFrames[side].highlights.push({ x, y, opacity: this.globalAlpha });
          }
          if (this.fillStyle === window.mazeProbe.frontierColor) {
            window.mazeProbe.currentFrames[side].frontiers.push({ x, y, opacity: this.globalAlpha });
          }
          const root = this.canvas.closest("#gutter-mazes-root");
          const key = `${root.dataset.round}:${side}:${x}:${y}`;
          if (!revealedCells.has(key) && root.dataset.state === "searching") {
            revealedCells.add(key);
            window.mazeProbe.reveals.push({ at: performance.now(), round: root.dataset.round, side, color: this.fillStyle });
          }
        }
        return fill.call(this, x, y, width, height);
      };
    });
    await page.clock.install();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    const root = page.locator("#gutter-mazes-root");
    await root.waitFor({ state: "attached" });
    assert.equal(await root.getAttribute("aria-hidden"), "true");
    assert.equal((await root.textContent()).trim(), "", "The illustration must have no text, legend, or controls.");
    assert.equal(await root.locator("button, input").count(), 0);
    assert.equal(await root.evaluate(element => getComputedStyle(element).pointerEvents), "none");
    for (const width of [2048, 1440, 1366, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1167 });
      await page.waitForTimeout(300);
      await checkGeometry(page, width >= 1366);
    }
    await page.setViewportSize({ width: 2048, height: 1167 });
    await page.waitForTimeout(300);
    assert.equal(await root.getAttribute("data-state"), "static");
    assert.equal(await paintCount(page), 0, "Reduced motion must never start the search.");
    const walls = await page.locator(".gutter-maze-walls path:first-child").evaluateAll(paths => paths.map(path => path.getAttribute("d")));
    assert.notEqual(walls[0], walls[1], "Both mazes must have different walls.");
    const bottom = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (const top of [1, 17, 51, 52, 53, 327, bottom, 0]) {
      await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), top);
      await page.waitForTimeout(100);
      await checkGeometry(page, true);
    }
    assert.equal(await root.getAttribute("data-state"), "static", "Scrolling must keep reduced-motion mazes static.");
    assert.equal(await paintCount(page), 0, "Scrolling must not start the reduced-motion search.");
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector("#gutter-mazes-root").dataset.state !== "static");
    await page.clock.runFor(2000);
    assert.equal(await root.getAttribute("data-state"), "searching");
    assert.ok(await paintCount(page) > 0, "Both searches must paint visible explored cells.");
    const progress = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => Number(course.dataset.expanded)));
    await page.clock.runFor(450);
    const nextProgress = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => Number(course.dataset.expanded)));
    assert.ok(nextProgress.every((expanded, index) => expanded - progress[index] === 3),
      "Batching the illustration must preserve three A* decisions per 450ms.");
    await page.clock.runFor(2550);
    const retained = await exploredCells(page);
    assert.ok(Object.values(retained).every(cells => cells.length > 4),
      "A* must retain its explored cells and frontier, instead of painting only a short solution trail.");
    const round = await root.getAttribute("data-round");
    const searchStyle = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return { activeOpacity: parseFloat(style.getPropertyValue("--maze-active-cell-opacity")),
        frontierOpacity: parseFloat(style.getPropertyValue("--maze-frontier-opacity")),
        exploredOpacity: parseFloat(style.getPropertyValue("--maze-explored-opacity")),
        frontierColor: style.getPropertyValue("--maze-frontier").trim(), exploredColor: style.getPropertyValue("--maze-explored").trim() };
    });
    const { activeOpacity, frontierOpacity, exploredOpacity } = searchStyle;
    const searchFrames = await page.evaluate(round => window.mazeProbe.frames.filter(frame => frame.round === round && frame.state === "searching"), round);
    assert.ok(searchFrames.every(frame => frame.highlights.length <= 1),
      "The outgoing square must finish fading before the incoming square appears.");
    for (const side of ["left", "right"]) {
      const groups = [];
      for (const frame of searchFrames.filter(frame => frame.side === side && frame.highlights.length)) {
        const highlight = frame.highlights[0];
        const key = `${highlight.x}:${highlight.y}`;
        if (groups.at(-1)?.key !== key) groups.push({ key, samples: [] });
        groups.at(-1).samples.push({ at: frame.at, opacity: highlight.opacity });
      }
      assert.ok(groups.length >= 3, "Both navigating squares must update during the race.");
      for (let index = 1; index < groups.length; index++) {
        const previous = groups[index - 1].samples;
        const current = groups[index].samples;
        const interval = current[0].at - previous[0].at;
        assert.ok(interval >= 850 && interval <= 1200, "Square positions must update about every 900ms, with time for the initial outgoing fade.");
        assert.ok(previous.at(-1).opacity < activeOpacity * 0.2, "The outgoing square must fade down before changing position.");
        assert.ok(current[0].opacity < activeOpacity * 0.1, "The incoming square must begin softly.");
        const full = current.find(sample => Math.abs(sample.opacity - activeOpacity) < 0.001);
        if (full) assert.ok(full.at - current[0].at >= 260 && full.at - current[0].at <= 350,
          "The incoming square must fade in gradually over about 320ms.");
      }
      for (const group of groups.slice(0, -1)) {
        const full = group.samples.filter(sample => Math.abs(sample.opacity - activeOpacity) < 0.001);
        const fadingOut = full.length && group.samples.find(sample => sample.at > full[0].at && sample.opacity < activeOpacity - 0.001);
        // The canvas holds its last paint between redraws; measure until the
        // first fade-out paint, including the time it remains untouched.
        assert.ok(fadingOut && fadingOut.at - full[0].at >= 300,
          "Each square must hold still between its longer fades.");
      }
      const frontierCells = new Map();
      const sideFrames = searchFrames.filter(frame => frame.side === side);
      for (const frame of sideFrames) {
        for (const square of frame.frontiers) {
          const key = `${square.x}:${square.y}`;
          if (!frontierCells.has(key)) frontierCells.set(key, []);
          frontierCells.get(key).push({ at: frame.at, opacity: square.opacity });
        }
      }
      let completedFadeIns = 0, completedFadeOuts = 0;
      for (const samples of frontierCells.values()) {
        assert.ok(samples.every(sample => sample.opacity <= frontierOpacity), "Yellow frontier squares must remain subtle in both themes.");
        assert.ok(samples[0].opacity < frontierOpacity * 0.1, "New yellow squares must begin with a gentle fade.");
        const full = samples.find(sample => Math.abs(sample.opacity - frontierOpacity) < 0.0001);
        if (full) {
          assert.ok(full.at - samples[0].at >= 260 && full.at - samples[0].at <= 350,
            "Yellow squares must use the same gradual 320ms fade-in as the navigating square.");
          completedFadeIns++;
        }
        const last = samples.at(-1);
        if (last.at < sideFrames.at(-1).at) {
          assert.ok(last.opacity < frontierOpacity * 0.1, "Yellow squares must fade away before becoming explored cells.");
          completedFadeOuts++;
        }
      }
      assert.ok(completedFadeIns > 0 && completedFadeOuts > 0, "Both sides must show gradual yellow fade-ins and fade-outs.");
    }
    const reveals = await page.evaluate(({ round, color }) => window.mazeProbe.reveals.filter(reveal => reveal.round === round && reveal.color === color),
      { round, color: searchStyle.exploredColor });
    for (const side of ["left", "right"]) {
      const times = [...new Set(reveals.filter(reveal => reveal.side === side).map(reveal => reveal.at))];
      assert.ok(times.length >= 3, "Search progress must appear in multiple batches.");
      for (let index = 1; index < times.length; index++) {
        assert.ok(times[index] - times[index - 1] >= 850,
          "Explored cells must update in quiet 900ms batches, independently of fast decisions.");
      }
    }
    // Inspect a settled batch, after the old square has finished fading away.
    for (let attempt = 0; attempt < 40; attempt++) {
      const settled = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const color = style.getPropertyValue("--maze-path-fill").trim();
        const opacity = parseFloat(style.getPropertyValue("--maze-active-cell-opacity"));
        return Object.values(window.mazeProbe.last).every(fills => {
          const squares = fills.filter(fill => fill.color === color);
          return squares.length === 1 && Math.abs(squares[0].opacity - opacity) < 0.001;
        });
      });
      if (settled) break;
      await page.clock.runFor(16);
    }
    const activeSquares = await page.locator(".gutter-maze-course").evaluateAll(courses => {
      const style = getComputedStyle(document.documentElement);
      const color = style.getPropertyValue("--maze-path-fill").trim();
      const unit = parseFloat(document.documentElement.style.getPropertyValue("--grid-unit"));
      return courses.map(course => ({
        columns: Number(course.dataset.columns), rows: Number(course.dataset.rows), seed: Number(course.dataset.seed),
        start: Number(course.dataset.start), goal: Number(course.dataset.goal), expanded: Number(course.dataset.expanded),
        squares: window.mazeProbe.last[course.dataset.side].filter(fill => fill.color === color)
          .map(fill => Math.round((fill.y - 1) / unit) * Number(course.dataset.columns) + Math.round((fill.x - 1) / unit))
      }));
    });
    for (const course of activeSquares) {
      assert.equal(course.squares.length, 1, "Highlight only the navigating square, with no green route during search.");
      const search = createMazeSearch(generateMaze(course.columns, course.rows, course.seed, course.start, course.goal % course.columns));
      let matched = false;
      for (let step = 1; step <= course.expanded; step++) {
        search.step();
        if (step < course.expanded - 6) continue;
        if (search.current === course.squares[0]) matched = true;
      }
      assert.ok(matched, "The highlighted square must match a real A* selection from the current batch.");
    }
    for (const top of [1, 17, 51, 52, 53, 113, 327, 0]) {
      await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), top);
      await page.clock.runFor(100);
      await checkGeometry(page, true);
    }
    await page.mouse.move(1024, 600);
    await page.mouse.wheel(0, 127);
    // Wheel scrolling is handled by the browser compositor, outside virtual time.
    await page.waitForTimeout(100);
    await page.clock.runFor(150);
    assert.ok(await page.evaluate(() => scrollY > 0), "The wheel regression check must scroll the main content.");
    await checkGeometry(page, true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.clock.runFor(100);
    await checkGeometry(page, true);
    await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL(`../.artifacts/maze-search-${theme}.png`, import.meta.url).pathname });
    assert.deepEqual(await page.locator(".gutter-maze-walls path:first-child").evaluateAll(paths => paths.map(path => path.getAttribute("d"))), walls,
      "Scrolling must preserve wall geometry and the active search.");
    assert.equal(await root.getAttribute("data-round"), round);

    const beforeResize = await page.locator(".gutter-maze-course").evaluateAll(courses =>
      courses.map(course => ({ seed: course.dataset.seed, expanded: Number(course.dataset.expanded) })));
    // Keep the document's row count unchanged; larger width changes can
    // rewrap project copy and require a different full-page maze.
    for (const width of [2049, 2050, 2048]) {
      await page.setViewportSize({ width, height: 1167 });
      // Deliver the resize before advancing the paused browser clock; native
      // viewport events can otherwise wait for a real compositor frame.
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      assert.notEqual(await root.getAttribute("data-state"), "paused", "The resize handler must keep the animation loop running.");
      await page.clock.runFor(80);
      assert.equal(await root.getAttribute("data-state"), "searching", "Zoom/resize must never pause or fade out a running maze.");
      assert.equal(await root.getAttribute("data-round"), round, "Resizing within the same grid dimensions must preserve the current race.");
      await checkGeometry(page, true);
    }
    const afterResize = await page.locator(".gutter-maze-course").evaluateAll(courses =>
      courses.map(course => ({ seed: course.dataset.seed, expanded: Number(course.dataset.expanded) })));
    assert.deepEqual(afterResize.map(course => course.seed), beforeResize.map(course => course.seed));
    assert.ok(afterResize.every((course, index) => course.expanded > beforeResize[index].expanded),
      "A* must keep advancing throughout repeated viewport resizes.");

    await page.locator(".project-details-button").first().click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await root.getAttribute("data-state"), "paused");
    const pausedProgress = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => Number(course.dataset.expanded)));
    const pausedCount = await paintCount(page);
    await page.clock.runFor(5000);
    assert.equal(await paintCount(page), pausedCount, "No frames should paint behind a gallery.");
    await page.keyboard.press("Escape");
    await page.clock.runFor(40);
    assert.equal(await root.getAttribute("data-state"), "searching");
    assert.equal(await root.getAttribute("data-round"), round, "Closing a gallery must preserve the search.");
    const resumedProgress = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => Number(course.dataset.expanded)));
    assert.ok(resumedProgress.every((expanded, index) => expanded - pausedProgress[index] <= 1),
      "Resuming may make the next decision, but must not skip the search while paused.");

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenCount = await paintCount(page);
    await page.clock.runFor(5000);
    assert.equal(await paintCount(page), hiddenCount, "Hidden tabs must stop the animation loop.");
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(40);
    assert.equal(await root.getAttribute("data-round"), round);

    const beforeResult = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => ({
      seed: Number(course.dataset.seed), columns: Number(course.dataset.columns), rows: Number(course.dataset.rows),
      start: Number(course.dataset.start), goal: Number(course.dataset.goal),
      path: course.querySelector(".gutter-maze-solution").getAttribute("d"),
    })));
    assert.ok(beforeResult.every(course => !course.path), "The final path stays hidden during search.");
    const expected = beforeResult.map(course => {
      const maze = generateMaze(course.columns, course.rows, course.seed, course.start, course.goal % course.columns);
      const search = createMazeSearch(maze);
      while (search.status === "searching") search.step();
      return { maze, search };
    });
    const firstFinish = Math.min(...expected.map(({ search }) => search.expanded));
    // Advance one decision at a time near the finish, capturing the actual
    // celebrating frame instead of skipping the flash with a giant timer jump.
    for (let attempt = 0; attempt <= firstFinish; attempt++) {
      if (await root.getAttribute("data-state") === "celebrating") break;
      await page.clock.runFor(220);
    }
    assert.equal(await root.getAttribute("data-state"), "celebrating");
    const frozenProgress = await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => course.dataset.expanded));
    await page.clock.runFor(350);
    assert.deepEqual(await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => course.dataset.expanded)), frozenProgress,
      "Both searches stop when the first goal is selected.");
    await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
    await page.screenshot({ path: new URL(`../.artifacts/maze-result-${theme}.png`, import.meta.url).pathname });
    const result = await page.evaluate(round => window.mazeProbe.results.find(result => result.round === round), round);
    assert.ok(result, "Each round must mark the race outcome.");
    const unit = await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue("--grid-unit")));
    for (const [index, course] of result.courses.entries()) {
      const wins = expected[index].search.expanded === firstFinish;
      assert.equal(course.expanded, firstFinish, "Both sides get exactly one A* expansion per decision.");
      assert.equal(course.outcome, wins ? "win" : "lose", "The first search to select its goal wins; the other side loses.");
      assert.equal(course.animation, wins ? "maze-win-pulse" : "maze-lose-pulse", "Pulse all the maze walls in the correct outcome color.");
      assert.equal(course.walls, walls[index], "Wall geometry must stay completely static through the result pulse.");
      if (wins) {
        const expectedPath = expected[index].search.path.map(cell => {
          const x = (cell % course.columns) * unit + 1, y = Math.floor(cell / course.columns) * unit + 1;
          return `M${x} ${y}h${unit - 2}v${unit - 2}h${2 - unit}Z`;
        }).join("");
        assert.equal(course.path, expectedPath, "The green flash must fill every cell in the genuine optimal A* path.");
        assert.notEqual(course.pathFill, "none", "The winning route must use filled grid cells.");
        assert.equal(course.pathStroke, "none", "The winning route must not draw a connecting line.");
        assert.equal(course.length, expected[index].search.path.length);
        assert.equal(course.pathAnimation, "maze-path-pulse", "Flash the winner's optimal path with its walls.");
      } else {
        assert.equal(course.path, null, "The loser must not reveal a solution.");
        assert.equal(course.pathAnimation, "none", "Only the loser's maze walls flash red.");
      }
    }
    await page.clock.runFor(2200);
    assert.equal(await root.getAttribute("data-state"), "celebrating", "Keep the result on screen for the longer hold.");
    assert.equal(await root.getAttribute("data-round"), round);
    const heldPath = await page.locator('.gutter-maze-course[data-outcome="win"] .gutter-maze-solution').evaluate(path => ({
      opacity: Number(getComputedStyle(path).opacity),
      target: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--maze-path-opacity")),
    }));
    assert.ok(Math.abs(heldPath.opacity - heldPath.target) < 0.001,
      "The winning path must remain fully highlighted more than two seconds after the finish.");
    assert.deepEqual(await page.locator(".gutter-maze-course").evaluateAll(courses => courses.map(course => course.dataset.expanded)), frozenProgress,
      "The searches must stay frozen throughout the longer result hold.");
    // Pause during the flash as well as during search.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.ok(await page.locator('.gutter-maze-course[data-outcome="win"] .gutter-maze-solution').evaluateAll(paths =>
      paths.every(path => getComputedStyle(path).animationPlayState === "paused")), "The optimal-path flash pauses with the tab.");
    await page.clock.runFor(1000);
    assert.equal(await root.getAttribute("data-round"), round);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    await page.clock.runFor(2000);
    assert.ok(Number(await root.getAttribute("data-round")) > Number(round), "The result flash must lead to a fresh pair.");
    const reset = await page.evaluate(round => window.mazeProbe.rounds.find(event => Number(event.round) === Number(round) + 1), round);
    assert.ok(reset.at - result.at >= 5250 && reset.at - result.at < 5420,
      "Start the next round after the paused interval, pulse, and exit fade, with no extra quiet hold.");
    assert.notDeepEqual(await page.locator(".gutter-maze-walls path:first-child").evaluateAll(paths => paths.map(path => path.getAttribute("d"))), walls);
    // Native media-query events follow the browser's rendering cycle,
    // independently of the virtual timers used to fast-forward races.
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await root.getAttribute("data-state") === "static") break;
      await page.waitForTimeout(50);
      await page.clock.runFor(50);
    }
    assert.equal(await root.getAttribute("data-state"), "static", JSON.stringify(await page.evaluate(() => ({
      motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      hidden: document.hidden, overflow: document.documentElement.style.overflow,
    }))));
    const reducedCount = await paintCount(page);
    await page.clock.runFor(2000);
    assert.equal(await paintCount(page), reducedCount, "Changing to reduced motion must stop the loop immediately.");
    assert.equal(await root.getAttribute("data-state"), "static");
    assert.equal(await page.locator(".gutter-maze-search").first().evaluate(canvas =>
      canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.some(value => value)), false,
    "Reduced motion must clear the search while keeping the walls.");
    assert.equal(await page.evaluate(() => window.mazeProbe.text), 0, "The canvas must never draw numbers or letters.");
    assert.equal(await page.evaluate(() => window.mazeProbe.strokes), 0, "The search must never draw dots, diamonds, or connecting lines.");
    const fills = await page.evaluate(() => window.mazeProbe.fills);
    assert.ok(fills.some(fill => fill.opacity > 0 && fill.opacity < 0.018), "New progress must fade gently into each batch.");
    const activeStyle = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return { color: style.getPropertyValue("--maze-path-fill").trim(), opacity: parseFloat(style.getPropertyValue("--maze-active-cell-opacity")) };
    });
    assert.ok(activeStyle.opacity > Math.max(frontierOpacity, exploredOpacity),
      "The navigating square must stand out from explored cells and frontier branches.");
    assert.ok(fills.some(fill => fill.color === searchStyle.exploredColor && Math.abs(fill.opacity - exploredOpacity) < 0.001),
      "Explored cells must reach their stronger theme-specific opacity.");
    assert.ok(fills.some(fill => fill.color === activeStyle.color && Math.abs(fill.opacity - activeStyle.opacity) < 0.001),
      "Both themes must render an apparent navigating square during search.");
    assert.ok(fills.every(fill => fill.opacity <= (fill.color === activeStyle.color ? activeStyle.opacity
      : fill.color === searchStyle.exploredColor ? exploredOpacity : frontierOpacity)),
      "Only the navigating square should receive stronger emphasis.");
    for (const fill of fills) {
      near(fill.x - 1, Math.round((fill.x - 1) / fill.unit) * fill.unit, "Green fills must stay on lattice columns");
      near(fill.y - 1, Math.round((fill.y - 1) / fill.unit) * fill.unit, "Green fills must stay on lattice rows");
    }
    assert.deepEqual(errors, [], "The maze must not introduce browser or hydration errors.");
    const compactHeight = await root.evaluate(element => element.getBoundingClientRect().height);
    const currentRound = await root.getAttribute("data-round");
    const currentWalls = await page.locator(".gutter-maze-walls path:first-child").evaluateAll(paths => paths.map(path => path.getAttribute("d")));
    await page.locator(".project-details-button").first().click();
    await page.getByRole("dialog").waitFor();
    assert.match(await page.getByRole("dialog").innerText(), /Custom Hardware/);
    await page.clock.runFor(100);
    await page.waitForTimeout(100);
    near(await root.evaluate(element => element.getBoundingClientRect().height), compactHeight,
      "Project Notes in the dialog must preserve the maze height");
    await page.keyboard.press("Escape");
    // Check the restored document geometry directly: dialog exit animations
    // need rendering frames that do not reliably finish under the paused clock.
    await page.clock.runFor(100);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "",
      "Closing details must unlock the background page.");
    await page.waitForTimeout(100);
    await page.clock.runFor(100);
    await checkGeometry(page, true);
    near(await root.evaluate(element => element.getBoundingClientRect().height), compactHeight,
      "Closing details must preserve the maze height");
    assert.equal(await root.getAttribute("data-round"), currentRound, "Project Notes must never restart the maze.");
    assert.deepEqual(await page.locator(".gutter-maze-walls path:first-child").evaluateAll(paths => paths.map(path => path.getAttribute("d"))), currentWalls,
      "Opening and closing details must keep every maze wall fixed.");
    await page.close();
  }
  console.log("Gutter mazes passed: document-aligned walls and tiles through the page bottom, stable Notes dialogs, colored search fades, A* races, gallery/tab pauses, and reduced motion in both themes.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
