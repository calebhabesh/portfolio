// Aceternity's pastel palette, without its extra grid, borders, or skew.
const COLORS = ["#93c5fd", "#f9a8d4", "#86efac", "#fde047", "#fca5a5", "#d8b4fe", "#a5b4fc", "#c4b5fd"];
const HOLD_MS = 90;
const FADE_MS = 560;
const MAX_CELLS = 64;

export function initGridPointerTrail(canvas) {
  const context = canvas.getContext("2d");
  const shell = document.querySelector(".page-shell");
  if (!context || !shell) return;

  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(any-pointer: fine)");
  const cardFrames = [...document.querySelectorAll(".project-frame")];
  const cells = new Map();
  let occupiedCells = [];
  let frame;
  let previousPoint;
  let pendingPoint;
  let lastPointerPosition;
  let width = 0, height = 0;
  let unit, originX, originY, peakOpacity;

  const clear = () => {
    const hadTrail = cells.size > 0 || pendingPoint !== undefined;
    cancelAnimationFrame(frame);
    frame = undefined;
    previousPoint = pendingPoint = undefined;
    cells.clear();
    if (hadTrail) context.clearRect(0, 0, width, height);
  };

  const measure = () => {
    clear();
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    unit = parseFloat(root.style.getPropertyValue("--grid-unit"));
    originX = shell.getBoundingClientRect().left;
    originY = parseFloat(root.style.getPropertyValue("--grid-origin-y"));
    peakOpacity = parseFloat(getComputedStyle(canvas).getPropertyValue("--grid-trail-opacity"));
    // Frames span whole grid rows. Use their layout rows, rather than the
    // card entrance's temporary horizontal translation, to reserve cells.
    occupiedCells = cardFrames.map(element => {
      const rect = element.getBoundingClientRect();
      return {
        columns: Math.round(rect.width / unit),
        firstRow: Math.floor((rect.top + scrollY - originY) / unit + 0.001),
        lastRow: Math.ceil((rect.bottom + scrollY - originY) / unit - 0.001),
      };
    });
    // The portrait is the blueprint's first cell.
    occupiedCells.push({ columns: 1, firstRow: 0, lastRow: 1 });
  };

  const activate = (x, y, now) => {
    const column = Math.floor((x - originX) / unit);
    const row = Math.floor((y + scrollY - originY) / unit);
    if (occupiedCells.some(area => column >= 0 && column < area.columns
      && row >= area.firstRow && row < area.lastRow)) return;
    const key = `${column}:${row}`;
    const color = cells.get(key)?.color || COLORS[Math.floor(Math.random() * COLORS.length)];
    cells.delete(key);
    cells.set(key, { column, row, color, time: now });
    if (cells.size > MAX_CELLS) cells.delete(cells.keys().next().value);
  };

  const paint = now => {
    frame = undefined;
    if (pendingPoint) {
      const point = pendingPoint;
      pendingPoint = undefined;
      // Bridge fast pointer moves so crossed cells do not leave holes.
      const from = previousPoint || point;
      const steps = Math.min(MAX_CELLS, Math.max(1, Math.ceil(Math.max(
        Math.abs(point.x - from.x), Math.abs(point.y - from.y),
      ) / (unit / 3))));
      for (let step = 1; step <= steps; step++) {
        activate(from.x + (point.x - from.x) * step / steps,
          from.y + (point.y - from.y) * step / steps, now);
      }
      previousPoint = point;
    }

    context.clearRect(0, 0, width, height);
    for (const [key, cell] of cells) {
      const age = now - cell.time;
      if (age >= HOLD_MS + FADE_MS) {
        cells.delete(key);
        continue;
      }
      const fade = 1 - Math.max(0, age - HOLD_MS) / FADE_MS;
      context.globalAlpha = peakOpacity * fade * fade;
      context.fillStyle = cell.color;
      // Leave the existing one-pixel grid lines visible around each fill.
      context.fillRect(originX + cell.column * unit + 0.5,
        originY + cell.row * unit - scrollY + 0.5, unit - 1, unit - 1);
    }
    context.globalAlpha = 1;
    // No idle animation loop: the last cell expires even under the cursor.
    if (cells.size) frame = requestAnimationFrame(paint);
    else previousPoint = undefined;
  };

  const isCard = event => event.target instanceof Element
    && Boolean(event.target.closest(".project-frame, .headshot-frame"));
  const onPointerOver = event => { if (isCard(event)) clear(); };
  const onPointerMove = event => {
    if (isCard(event)) {
      clear();
      lastPointerPosition = { x: event.clientX, y: event.clientY };
      return;
    }
    if (reducedMotion.matches || !finePointer.matches || event.pointerType === "touch"
      || root.style.overflow === "hidden" || document.hidden || !(unit > 0)) return;
    if (lastPointerPosition?.x === event.clientX && lastPointerPosition?.y === event.clientY) return;
    lastPointerPosition = pendingPoint = { x: event.clientX, y: event.clientY };
    frame ??= requestAnimationFrame(paint);
  };
  const onVisibility = () => { if (document.hidden) clear(); };
  // Follow the blueprint's measured variables after resize/font/layout changes
  // without changing or independently rounding the existing grid.
  const observer = new MutationObserver(measure);
  observer.observe(root, { attributes: true, attributeFilter: ["style", "data-theme"] });
  const frameObserver = new ResizeObserver(measure);
  cardFrames.forEach(element => frameObserver.observe(element));
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerover", onPointerOver, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("scroll", clear, { passive: true });
  window.addEventListener("blur", clear);
  document.addEventListener("pointerleave", clear);
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", measure);
  finePointer.addEventListener("change", measure);
  measure();

  return () => {
    clear();
    observer.disconnect();
    frameObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerover", onPointerOver);
    window.removeEventListener("resize", measure);
    window.removeEventListener("scroll", clear);
    window.removeEventListener("blur", clear);
    document.removeEventListener("pointerleave", clear);
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", measure);
    finePointer.removeEventListener("change", measure);
  };
}
