import { CELL_STATE, createMazeSearch, generateMaze, seededRandom } from "./maze-pathfinding.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PENCIL_GRAIN_URL = new URL("./assets/pencil-grain.svg", import.meta.url).href;
const STEP_MS = 150;
const SEARCH_BATCH_SIZE = 6;
const REVEAL_MS = 900;
const REVEAL_FADE_MS = 560;
const ACTIVE_UPDATE_MS = 900;
const ACTIVE_FADE_OUT_MS = 240;
const ACTIVE_FADE_IN_MS = 320;
const ENTRY_MS = 800;
const EXIT_MS = 700;
const PULSE_MS = 3600;
const FRAME_MS = 1000 / 60;
const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function sketchWalls(maze, unit) {
  const random = seededRandom(maze.seed ^ 0x5A17);
  const strokes = [[], []];
  const scale = unit / 52;
  const line = (x1, y1, x2, y2) => {
    const horizontal = y1 === y2;
    const points = [];
    // A grainy pencil stroke with a few closely retraced marks.
    // Keep its endpoints fixed so adjoining walls meet on the page grid.
    for (let point = 0; point <= 8; point++) {
      const t = point / 8;
      const drift = point === 0 || point === 8 ? 0 : (random() - 0.5) * 1.7 * scale;
      const x = x1 + (x2 - x1) * t + (horizontal ? 0 : drift);
      const y = y1 + (y2 - y1) * t + (horizontal ? drift : 0);
      points.push(`${point ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    strokes[0].push(points.join(""));
    // Keep the occasional second pass within the original stroke's width.
    // Short spans vary the pencil pressure without separating into strands.
    if (random() < 0.65) {
      const start = 0.1 + random() * 0.18;
      const end = 0.65 + random() * 0.25;
      const offset = (random() < 0.5 ? -0.35 : 0.35) * scale;
      const retrace = [];
      for (let point = 0; point <= 5; point++) {
        const t = start + (end - start) * point / 5;
        const drift = offset + (random() - 0.5) * 0.9 * scale;
        const x = x1 + (x2 - x1) * t + (horizontal ? 0 : drift);
        const y = y1 + (y2 - y1) * t + (horizontal ? drift : 0);
        retrace.push(`${point ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      strokes[1].push(retrace.join(""));
    }
  };
  for (let row = 0; row < maze.rows; row++) {
    for (let column = 0; column < maze.columns; column++) {
      const walls = maze.walls[row * maze.columns + column];
      const x = column * unit, y = row * unit;
      // Draw shared walls once, with their junctions on the page lattice.
      if (walls & 1) line(x, y, x + unit, y);
      // The page grid supplies the outer edges; sketch only interior walls.
      if (column > 0 && walls & 8) line(x, y, x, y + unit);
      if (row === maze.rows - 1 && walls & 4) line(x, y + unit, x + unit, y + unit);
    }
  }
  return strokes.map(paths => paths.join(""));
}

function solutionCells(maze, path, unit) {
  return path.map(cell => {
    const x = (cell % maze.columns) * unit + 1;
    const y = Math.floor(cell / maze.columns) * unit + 1;
    return `M${x} ${y}h${unit - 2}v${unit - 2}h${2 - unit}Z`;
  }).join("");
}

function sizeCourse(course, left, geometry) {
  const { unit, height, drawingHeight, ratio } = geometry;
  const { element, maze, search, solution, context } = course;
  const width = maze.columns * unit;
  const svg = element.querySelector("svg");
  const canvas = element.querySelector("canvas");
  Object.assign(element.style, { left: `${left}px`, width: `${width}px`, height: `${height}px` });
  element.style.setProperty("--maze-left", `${left}px`);
  element.style.setProperty("--maze-width", `${width}px`);
  svg.setAttribute("viewBox", `0 0 ${width} ${drawingHeight}`);
  svg.style.height = `${drawingHeight}px`;
  sketchWalls(maze, unit).forEach((stroke, index) => svg.children[index].setAttribute("d", stroke));
  for (const target of svg.querySelectorAll("mask, mask rect")) {
    target.setAttribute("width", String(width));
    target.setAttribute("height", String(drawingHeight));
  }
  if (element.dataset.outcome === "win") solution.setAttribute("d", solutionCells(maze, search.path, unit));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(drawingHeight * ratio);
  canvas.style.height = `${drawingHeight}px`;
  context?.setTransform(canvas.width / width, 0, 0, canvas.height / drawingHeight, 0, 0);
  course.width = width;
  course.height = drawingHeight;
}

function createCourse(maze, side, left, geometry) {
  const element = document.createElement("div");
  element.className = "gutter-maze-course";
  Object.assign(element.dataset, { side, seed: String(maze.seed), columns: String(maze.columns), rows: String(maze.rows), start: String(maze.start), goal: String(maze.goal) });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("gutter-maze-walls");
  svg.setAttribute("preserveAspectRatio", "none");
  const wall = document.createElementNS(SVG_NS, "path");
  wall.classList.add("gutter-maze-wall-stroke");
  const grainId = `maze-grain-${side}-${maze.seed}`;
  wall.setAttribute("mask", `url(#${grainId})`);
  svg.append(wall);
  const retrace = document.createElementNS(SVG_NS, "path");
  retrace.classList.add("gutter-maze-wall-retrace");
  retrace.setAttribute("mask", `url(#${grainId})`);
  svg.append(retrace);
  const solution = document.createElementNS(SVG_NS, "path");
  solution.classList.add("gutter-maze-solution");
  svg.append(solution);
  // Tile one small grain image, rather than filtering the full-page maze.
  // Mask only the walls so the search and winning cell fills stay legible.
  const definitions = document.createElementNS(SVG_NS, "defs");
  const pattern = document.createElementNS(SVG_NS, "pattern");
  pattern.id = `${grainId}-tile`;
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", "64");
  pattern.setAttribute("height", "64");
  const grain = document.createElementNS(SVG_NS, "image");
  grain.setAttribute("href", PENCIL_GRAIN_URL);
  grain.setAttribute("width", "64");
  grain.setAttribute("height", "64");
  pattern.append(grain);
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.id = grainId;
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  mask.setAttribute("x", "0");
  mask.setAttribute("y", "0");
  const texture = document.createElementNS(SVG_NS, "rect");
  texture.setAttribute("fill", `url(#${pattern.id})`);
  mask.append(texture);
  definitions.append(pattern, mask);
  svg.append(definitions);
  const canvas = document.createElement("canvas");
  canvas.className = "gutter-maze-search";
  const context = canvas.getContext("2d");
  element.append(svg, canvas);
  const course = { element, maze, search: createMazeSearch(maze), context, solution,
    displayedStates: new Uint8Array(maze.walls.length), previousStates: new Uint8Array(maze.walls.length),
    activeCell: -1, previousActiveCell: -1 };
  sizeCourse(course, left, geometry);
  return course;
}

export function initGutterMazes() {
  const root = document.documentElement;
  const shell = document.querySelector(".page-shell");
  if (!shell) return;
  const container = document.createElement("div");
  container.id = "gutter-mazes-root";
  container.setAttribute("aria-hidden", "true");
  document.body.append(container);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let geometry, courses = [], frame, measureFrame;
  let elapsed = 0, previousTime, paintedAt = -Infinity, revealedAt = ENTRY_MS, round = 0, resolvedAt;
  let activeUpdatedAt = ENTRY_MS;
  let colors, activeCellOpacity, frontierOpacity, exploredOpacity, searchPaintPending = true;
  let disposed = false;
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  const random = seededRandom(seed[0]);

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
  };
  const updateColors = () => {
    const style = getComputedStyle(root);
    colors = Object.fromEntries(["maze-frontier", "maze-explored", "maze-path-fill"].map(name =>
      [name, style.getPropertyValue(`--${name}`).trim()]));
    activeCellOpacity = parseFloat(style.getPropertyValue("--maze-active-cell-opacity"));
    frontierOpacity = parseFloat(style.getPropertyValue("--maze-frontier-opacity"));
    exploredOpacity = parseFloat(style.getPropertyValue("--maze-explored-opacity"));
    searchPaintPending = true;
  };
  const newRound = () => {
    const start = Math.floor(random() * geometry.columns), goal = Math.floor(random() * geometry.columns);
    courses = ["left", "right"].map((side, index) => {
      const maze = generateMaze(geometry.columns, geometry.rows, Math.floor(random() * 4294967296), start, goal);
      return createCourse(maze, side, index ? geometry.right : geometry.left, geometry);
    });
    container.replaceChildren(...courses.map(course => course.element));
    container.dataset.round = String(++round);
    elapsed = 0;
    resolvedAt = undefined;
    paintedAt = -Infinity;
    revealedAt = ENTRY_MS;
    activeUpdatedAt = ENTRY_MS;
    searchPaintPending = true;
  };
  const phase = () => elapsed < ENTRY_MS ? "entering"
    : resolvedAt === undefined ? "searching"
    : elapsed < resolvedAt + PULSE_MS ? "celebrating" : "exiting";
  const advance = course => {
    const { search, element } = course;
    search.step();
    // These attributes expose real progress to browser checks, with no UI text.
    Object.assign(element.dataset, { expanded: String(search.expanded), frontier: String(search.frontierCount) });
  };
  const revealSearches = () => {
    // Snapshot progress independently of A*: decisions stay fast while the
    // peripheral illustration changes only once per batch.
    for (const course of courses) {
      course.previousStates = course.displayedStates;
      course.displayedStates = course.search.states.slice();
    }
    revealedAt = elapsed;
    searchPaintPending = true;
  };
  const updateActiveCells = () => {
    for (const course of courses) {
      course.previousActiveCell = course.activeCell;
      course.activeCell = course.search.current;
    }
    activeUpdatedAt = elapsed;
    searchPaintPending = true;
  };
  const activeHighlight = course => {
    if (resolvedAt !== undefined) {
      return { cell: course.finalHighlight.cell,
        opacity: course.finalHighlight.opacity * (1 - ease((elapsed - resolvedAt) / ACTIVE_FADE_OUT_MS)) };
    }
    const age = elapsed - activeUpdatedAt;
    const fadeOut = course.previousActiveCell >= 0 ? ACTIVE_FADE_OUT_MS : 0;
    // Finish fading the old square before showing the next selection.
    if (fadeOut > 0 && age < fadeOut) return { cell: course.previousActiveCell, opacity: 1 - ease(age / fadeOut) };
    return { cell: course.activeCell, opacity: ease((age - fadeOut) / ACTIVE_FADE_IN_MS) };
  };
  const resolve = () => {
    if (!courses.some(course => course.search.status === "found")) return;
    for (const course of courses) course.finalHighlight = activeHighlight(course);
    resolvedAt = elapsed;
    revealSearches();
    for (const { element, search, solution, maze } of courses) {
      const won = search.status === "found";
      if (won) {
        const { unit } = geometry;
        // Fill the winning cells, preserving the same one-pixel grid inset
        // as the search squares. Only the genuine optimal path is revealed.
        solution.setAttribute("d", solutionCells(maze, search.path, unit));
        element.dataset.pathLength = String(search.path.length);
      }
      // Simultaneous finishes give both courses the green flash.
      element.dataset.outcome = won ? "win" : "lose";
    }
  };
  const paintSearches = () => {
    const age = elapsed - revealedAt;
    const blend = ease(age / REVEAL_FADE_MS);
    const frontierOut = 1 - ease(age / ACTIVE_FADE_OUT_MS);
    const frontierIn = ease((age - ACTIVE_FADE_OUT_MS) / ACTIVE_FADE_IN_MS);
    for (const course of courses) {
      const { maze, displayedStates, previousStates, context, width, height } = course;
      if (!context) continue;
      context.clearRect(0, 0, width, height);
      if (reducedMotion.matches) continue;
      const { unit } = geometry;
      const fill = (cell, color, opacity) => {
        if (cell < 0 || opacity <= 0) return;
        context.fillStyle = color;
        context.globalAlpha = opacity;
        context.fillRect((cell % maze.columns) * unit + 1,
          Math.floor(cell / maze.columns) * unit + 1, unit - 2, unit - 2);
      };
      const dim = resolvedAt === undefined ? 1 : 1 - 0.55 * ease((elapsed - resolvedAt) / REVEAL_FADE_MS);
      const highlight = activeHighlight(course);
      const fillState = (cell, state, opacity) => {
        if (state === CELL_STATE.explored) fill(cell, colors["maze-explored"], exploredOpacity * dim * opacity);
        else if (state === CELL_STATE.frontier) fill(cell, colors["maze-frontier"], frontierOpacity * dim * opacity);
      };
      for (let cell = 0; cell < maze.walls.length; cell++) {
        const opacity = cell === highlight.cell ? 1 - highlight.opacity : 1;
        if (previousStates[cell] === displayedStates[cell]) fillState(cell, displayedStates[cell], opacity);
        else if (previousStates[cell] === CELL_STATE.frontier || displayedStates[cell] === CELL_STATE.frontier) {
          // Keep unchanged frontier cells still. Changed yellow cells fade
          // away before the next batch fades in, just like the green square.
          fillState(cell, previousStates[cell], frontierOut * opacity);
          fillState(cell, displayedStates[cell], frontierIn * opacity);
        }
        else {
          fillState(cell, previousStates[cell], (1 - blend) * opacity);
          fillState(cell, displayedStates[cell], blend * opacity);
        }
      }
      fill(highlight.cell, colors["maze-path-fill"], activeCellOpacity * highlight.opacity);
      context.globalAlpha = 1;
    }
  };
  const tick = now => {
    frame = undefined;
    // Suspended tabs and galleries resume from the same search decision.
    if (previousTime !== undefined) elapsed += Math.min(now - previousTime, 100);
    previousTime = now;
    if (resolvedAt === undefined && elapsed >= ENTRY_MS + (courses[0].search.expanded / SEARCH_BATCH_SIZE + 1) * STEP_MS) {
      // More decisions per beat bring back the winning path sooner. Keep
      // the 900ms visual cadence and check both sides after every decision
      // so batching cannot skip the true winner or create a false tie.
      for (let step = 0; step < SEARCH_BATCH_SIZE && resolvedAt === undefined; step++) {
        for (const course of courses) advance(course);
        resolve();
      }
    }
    if (resolvedAt === undefined && elapsed - revealedAt >= REVEAL_MS) revealSearches();
    if (resolvedAt === undefined && elapsed - activeUpdatedAt >= ACTIVE_UPDATE_MS) updateActiveCells();
    if (resolvedAt !== undefined && elapsed >= resolvedAt + PULSE_MS + EXIT_MS) newRound();
    const nextPhase = phase();
    if (container.dataset.state !== nextPhase) container.dataset.state = nextPhase;
    if (now - paintedAt >= FRAME_MS) {
      const opacity = elapsed < ENTRY_MS ? ease(elapsed / ENTRY_MS)
        : resolvedAt !== undefined && elapsed > resolvedAt + PULSE_MS
          ? 1 - ease((elapsed - resolvedAt - PULSE_MS) / EXIT_MS) : 1;
      if (container.style.opacity !== String(opacity)) container.style.opacity = String(opacity);
      if (searchPaintPending) {
        paintSearches();
        const fadingSearch = elapsed >= revealedAt && elapsed < revealedAt + REVEAL_FADE_MS;
        const fadingActive = resolvedAt === undefined
          ? elapsed >= activeUpdatedAt && elapsed < activeUpdatedAt + ACTIVE_FADE_OUT_MS + ACTIVE_FADE_IN_MS
          : elapsed < resolvedAt + ACTIVE_FADE_OUT_MS;
        searchPaintPending = fadingSearch || fadingActive;
      }
      paintedAt = now;
    }
    frame = requestAnimationFrame(tick);
  };
  const syncMotion = () => {
    if (!courses.length) { stop(); container.dataset.state = "hidden"; return; }
    if (document.hidden || root.style.overflow === "hidden") {
      stop();
      container.dataset.state = "paused";
      return;
    }
    if (reducedMotion.matches) {
      stop();
      container.dataset.state = "static";
      container.style.opacity = "1";
      paintSearches();
      return;
    }
    container.dataset.state = phase();
    paintedAt = -Infinity;
    searchPaintPending = true;
    frame ??= requestAnimationFrame(tick);
  };
  const measure = () => {
    measureFrame = undefined;
    if (disposed) return;
    if (root.style.overflow === "hidden") { syncMotion(); return; }
    const unit = parseFloat(root.style.getPropertyValue("--grid-unit"));
    if (!(unit > 0)) return;
    // Measure in-flow content so the maze cannot inflate its own height or
    // prevent the page from shrinking after Notes collapse.
    const width = root.clientWidth;
    const height = Math.max(innerHeight, Math.ceil(document.body.getBoundingClientRect().height));
    container.style.height = `${height}px`;
    const bounds = shell.getBoundingClientRect();
    const gutterColumns = Math.round(Math.min(bounds.left, width - bounds.right) / unit);
    const columns = gutterColumns - 2;
    // A full cell separates each course from the screen edge and content.
    if (width <= 768 || columns < 3 || innerHeight < unit * 3) {
      stop();
      courses = [];
      geometry = undefined;
      container.replaceChildren();
      container.dataset.state = "hidden";
      return;
    }
    const rows = Math.ceil(height / unit);
    const next = { unit, width, height, columns, rows, ratio: Math.min(devicePixelRatio || 1, 2), drawingHeight: rows * unit,
      left: unit, right: width - (columns + 1) * unit };
    if (!geometry || Object.keys(next).some(key => Math.abs(next[key] - geometry[key]) > 0.05)) {
      const sameMazeSize = geometry && columns === geometry.columns && rows === geometry.rows;
      const alreadyVisible = courses.length > 0;
      geometry = next;
      if (sameMazeSize) {
        // Browser zoom changes CSS pixels and canvas density. Resize the
        // drawing in place, preserving the searches and their animation clock.
        courses.forEach((course, index) => sizeCourse(course, index ? geometry.right : geometry.left, geometry));
      } else {
        newRound();
        // A different cell count needs new mazes, but resizing a visible
        // illustration must not restart its entrance fade on every event.
        if (alreadyVisible) elapsed = ENTRY_MS;
        container.style.opacity = alreadyVisible || reducedMotion.matches ? "1" : "0";
      }
    }
    updateColors();
    syncMotion();
  };
  const onResize = () => {
    cancelAnimationFrame(measureFrame);
    measureFrame = undefined;
    measure();
  };
  const onRootChange = () => {
    updateColors();
    if (root.style.overflow === "hidden") syncMotion();
    else onResize();
  };
  const observer = new MutationObserver(onRootChange);
  observer.observe(root, { attributes: true, attributeFilter: ["style", "data-theme"] });
  const shellObserver = new ResizeObserver(onResize);
  shellObserver.observe(shell);
  shellObserver.observe(document.body);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", syncMotion);
  reducedMotion.addEventListener("change", syncMotion);
  measure();

  return () => {
    disposed = true;
    stop();
    cancelAnimationFrame(measureFrame);
    observer.disconnect();
    shellObserver.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", syncMotion);
    reducedMotion.removeEventListener("change", syncMotion);
    container.remove();
  };
}
