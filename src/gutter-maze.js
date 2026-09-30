import { CELL_STATE, createMazeSearch, generateMaze, seededRandom } from "./maze-pathfinding.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STEP_MS = 150;
const REVEAL_MS = 900;
const REVEAL_FADE_MS = 560;
const ACTIVE_UPDATE_MS = 900;
const ACTIVE_FADE_OUT_MS = 240;
const ACTIVE_FADE_IN_MS = 320;
const ENTRY_MS = 600;
const EXIT_MS = 450;
const PULSE_MS = 1100;
const FRAME_MS = 1000 / 60;
const ease = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function sketchWalls(maze, unit) {
  const random = seededRandom(maze.seed ^ 0x5A17);
  const strokes = [[], [], []];
  const line = (x1, y1, x2, y2, boundary = false) => {
    for (let layer = 0; layer < 2; layer++) {
      const offset = layer ? (random() - 0.5) * 1.4 : 0;
      const horizontal = y1 === y2;
      const points = [];
      for (let point = 0; point <= 4; point++) {
        const t = point / 4;
        const wobble = point === 0 || point === 4 ? 0 : (random() - 0.5) * 1.1;
        const x = x1 + (x2 - x1) * t + (horizontal ? 0 : wobble + offset);
        const y = y1 + (y2 - y1) * t + (horizontal ? wobble + offset : 0);
        points.push(`${point ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      strokes[boundary && layer === 0 ? 2 : layer].push(points.join(""));
    }
  };
  for (let row = 0; row < maze.rows; row++) {
    for (let column = 0; column < maze.columns; column++) {
      const walls = maze.walls[row * maze.columns + column];
      const x = column * unit, y = row * unit;
      // Draw shared walls once; vertices stay on the lattice even though
      // each stroke has the same slight irregularity as the card crosses.
      if (walls & 1) line(x, y, x + unit, y);
      if (walls & 8) line(x, y, x, y + unit, column === 0);
      if (column === maze.columns - 1 && walls & 2) line(x + unit, y, x + unit, y + unit, true);
      if (row === maze.rows - 1 && walls & 4) line(x, y + unit, x + unit, y + unit);
    }
  }
  return strokes.map(paths => paths.join(""));
}

function createCourse(maze, side, left, geometry) {
  const { unit, height, drawingHeight } = geometry;
  const width = maze.columns * unit;
  const element = document.createElement("div");
  element.className = "gutter-maze-course";
  Object.assign(element.dataset, { side, seed: String(maze.seed), columns: String(maze.columns), rows: String(maze.rows), start: String(maze.start), goal: String(maze.goal) });
  Object.assign(element.style, { left: `${left}px`, width: `${width}px`, height: `${height}px` });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("gutter-maze-walls");
  svg.setAttribute("viewBox", `0 0 ${width} ${drawingHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.height = `${drawingHeight}px`;
  for (const [index, stroke] of sketchWalls(maze, unit).entries()) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", stroke);
    if (index === 1) path.classList.add("gutter-maze-wall-echo");
    if (index === 2) path.classList.add("gutter-maze-boundary");
    svg.append(path);
  }
  const solution = document.createElementNS(SVG_NS, "path");
  solution.classList.add("gutter-maze-solution");
  svg.append(solution);
  const canvas = document.createElement("canvas");
  canvas.className = "gutter-maze-search";
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(drawingHeight * ratio);
  canvas.style.height = `${drawingHeight}px`;
  const context = canvas.getContext("2d");
  context?.setTransform(canvas.width / width, 0, 0, canvas.height / drawingHeight, 0, 0);
  element.append(svg, canvas);
  return { element, maze, search: createMazeSearch(maze), context, solution, width, height: drawingHeight,
    displayedStates: new Uint8Array(maze.walls.length), previousStates: new Uint8Array(maze.walls.length),
    activeCell: -1, previousActiveCell: -1 };
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
  let geometry, courses = [], frame, resizeTimer;
  let elapsed = 0, previousTime, paintedAt = -Infinity, revealedAt = ENTRY_MS, round = 0, resolvedAt;
  let activeUpdatedAt = ENTRY_MS;
  let colors, activeCellOpacity, frontierOpacity, searchPaintPending = true;
  let disposed = false, resizing = false;
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
        solution.setAttribute("d", search.path.map(cell => {
          const x = (cell % maze.columns) * unit + 1;
          const y = Math.floor(cell / maze.columns) * unit + 1;
          return `M${x} ${y}h${unit - 2}v${unit - 2}h${2 - unit}Z`;
        }).join(""));
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
        if (state === CELL_STATE.explored) fill(cell, colors["maze-explored"], 0.018 * dim * opacity);
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
    if (resolvedAt === undefined && elapsed >= ENTRY_MS + (courses[0].search.expanded + 1) * STEP_MS) {
      for (const course of courses) advance(course);
      resolve();
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
    stop();
    if (!courses.length) { container.dataset.state = "hidden"; return; }
    if (resizing || document.hidden || root.style.overflow === "hidden") {
      container.dataset.state = "paused";
      return;
    }
    if (reducedMotion.matches) {
      container.dataset.state = "static";
      container.style.opacity = "1";
      paintSearches();
      return;
    }
    container.dataset.state = phase();
    paintedAt = -Infinity;
    searchPaintPending = true;
    frame = requestAnimationFrame(tick);
  };
  const measure = () => {
    if (disposed) return;
    if (root.style.overflow === "hidden") { syncMotion(); return; }
    const unit = parseFloat(root.style.getPropertyValue("--grid-unit"));
    if (!(unit > 0)) return;
    const width = root.clientWidth, height = innerHeight;
    const bounds = shell.getBoundingClientRect();
    const gutterColumns = Math.round(Math.min(bounds.left, width - bounds.right) / unit);
    const columns = gutterColumns - 2;
    // A full cell separates each course from the screen edge and content.
    if (width <= 768 || columns < 3 || height < unit * 3) {
      stop();
      courses = [];
      geometry = undefined;
      container.replaceChildren();
      container.dataset.state = "hidden";
      return;
    }
    const rows = Math.ceil(height / unit) + 1;
    const next = { unit, width, height, columns, rows, drawingHeight: rows * unit,
      left: unit, right: width - (columns + 1) * unit };
    if (!geometry || Object.keys(next).some(key => Math.abs(next[key] - geometry[key]) > 0.05)) {
      stop();
      geometry = next;
      newRound();
      container.style.opacity = reducedMotion.matches ? "1" : "0";
    }
    updateColors();
    syncMotion();
  };
  const onResize = () => {
    resizing = true;
    stop();
    container.dataset.state = courses.length ? "paused" : "hidden";
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizing = false; measure(); }, 160);
  };
  const onRootChange = () => {
    updateColors();
    if (!resizing) measure();
    else syncMotion();
  };
  const observer = new MutationObserver(onRootChange);
  observer.observe(root, { attributes: true, attributeFilter: ["style", "data-theme"] });
  const shellObserver = new ResizeObserver(() => { if (!resizing) measure(); });
  shellObserver.observe(shell);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", syncMotion);
  reducedMotion.addEventListener("change", syncMotion);
  measure();

  return () => {
    disposed = true;
    stop();
    clearTimeout(resizeTimer);
    observer.disconnect();
    shellObserver.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", syncMotion);
    reducedMotion.removeEventListener("change", syncMotion);
    container.remove();
  };
}
