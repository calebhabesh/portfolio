// The background and content share one square lattice. Measure untransformed
// layout, so Comet tilt and entrance animations never move the grid itself.
export function initBlueprintGrid() {
  const root = document.documentElement;
  const shell = document.querySelector(".page-shell");
  const portrait = document.querySelector(".hero-headshot");
  const heroCopy = document.querySelector(".hero-copy");
  const projects = document.querySelector("#projects-root");
  if (!shell || !portrait || !heroCopy || !projects) return;

  const frames = [...projects.querySelectorAll(".project-frame")];
  const contents = frames.map(frame => frame.querySelector(".project-box-inner"));
  // Keep measured styles outside React's hydrated markup. Changing inline
  // attributes on the static cards before hydration would produce mismatches.
  const style = document.createElement("style");
  style.dataset.blueprintGrid = "";
  style.textContent = frames.map((frame, index) =>
    `.project-card-animate[data-card-index="${index}"] { --project-grid-height: auto; }`,
  ).join("\n");
  document.head.append(style);
  const heightRules = [...style.sheet.cssRules];
  let scheduled;

  const setLength = (declaration, name, value) => {
    const length = `${value}px`;
    if (declaration.getPropertyValue(name) !== length) declaration.setProperty(name, length);
  };

  const update = () => {
    scheduled = undefined;
    const columns = Number(getComputedStyle(root).getPropertyValue("--grid-columns"));
    const inset = parseFloat(getComputedStyle(root).getPropertyValue("--project-frame-inset"));
    const unit = shell.getBoundingClientRect().width / columns;
    setLength(root.style, "--grid-unit", unit);

    // The portrait owns the row origin. Subtract the hero entrance's visual
    // translation to retain its final layout coordinates during startup.
    const transform = getComputedStyle(heroCopy).transform;
    const entranceY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    const origin = portrait.getBoundingClientRect().top + window.scrollY - entranceY;
    const projectsTop = projects.getBoundingClientRect().top + window.scrollY;
    const contentHeights = contents.map(content => parseFloat(getComputedStyle(content).height));
    const firstRow = Math.ceil((projectsTop - origin) / unit - 0.001);

    setLength(root.style, "--grid-origin-y", origin);
    setLength(projects.style, "--projects-grid-offset", Math.max(0, origin + firstRow * unit - projectsTop));
    heightRules.forEach((rule, index) => {
      const rows = Math.ceil((contentHeights[index] + 2 * inset) / unit - 0.001);
      setLength(rule.style, "--project-grid-height", rows * unit);
    });
  };

  const schedule = () => { scheduled ??= requestAnimationFrame(update); };
  const observer = new ResizeObserver(schedule);
  // Observe natural content, not the snapped frames: otherwise changing a
  // frame height would feed its own rounded height back into the calculation.
  [shell, document.querySelector(".hero"), heroCopy, ...contents].forEach(element => observer.observe(element));
  window.addEventListener("resize", schedule, { passive: true });
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener("loadingdone", schedule);
  update();

  return () => {
    observer.disconnect();
    style.remove();
    cancelAnimationFrame(scheduled);
    window.removeEventListener("resize", schedule);
    document.fonts.removeEventListener("loadingdone", schedule);
  };
}
