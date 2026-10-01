// Fit a whole, even number of cells across the viewport. Centering a shell
// with an even cell count then puts both edges on the zero-origin lattice.
export function initBlueprintGrid() {
  const root = document.documentElement;
  const shell = document.querySelector(".page-shell");
  const portrait = document.querySelector(".hero-headshot");
  const heroCopy = document.querySelector(".hero-copy");
  const hero = document.querySelector(".hero");
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
    if (root.style.overflow === "hidden") return;
    const computed = getComputedStyle(root);
    const columns = Number(computed.getPropertyValue("--grid-columns"));
    const inset = parseFloat(computed.getPropertyValue("--project-frame-inset"));
    const gutter = parseFloat(computed.getPropertyValue("--page-gutter"));
    const maximum = parseFloat(computed.getPropertyValue("--page-max-width"));
    const width = root.clientWidth;
    const mobile = width <= 768;
    const targetUnit = maximum / 18;
    const viewportColumns = Math.max(columns + 2, Math.ceil(width / targetUnit / 2) * 2);
    // Mobile retains its narrow gutters and uses approximately the same
    // 52px cells as desktop. Its grid columns begin at the content edge.
    const contentColumns = mobile ? Math.max(4, Math.round((width - 2 * gutter) / targetUnit)) : columns;
    const unit = mobile ? (width - 2 * gutter) / contentColumns : width / viewportColumns;
    setLength(root.style, "--grid-unit", unit);
    setLength(root.style, "--page-width", contentColumns * unit);
    setLength(root.style, "--grid-origin-x", mobile ? gutter : 0);
    setLength(root.style, "--portrait-unit", unit);
    setLength(root.style, "--project-grid-gap", unit);

    // Snap the portrait's final document position to a zero-origin row.
    // Subtract both the previous correction and the entrance transform to
    // avoid a feedback loop or following the animated visual position.
    const transform = getComputedStyle(heroCopy).transform;
    const entranceY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    const oldOffset = parseFloat(hero.style.getPropertyValue("--hero-grid-offset")) || 0;
    const naturalTop = portrait.getBoundingClientRect().top + window.scrollY - entranceY - oldOffset;
    setLength(hero.style, "--hero-grid-offset", Math.max(0, Math.ceil(naturalTop / unit - 0.001) * unit - naturalTop));
    const projectsTop = projects.getBoundingClientRect().top + window.scrollY;
    // Snap the compact card to whole rows. Desktop details buttons use the
    // spare space beside the badges; mobile buttons keep their own row.
    // Expanded content never changes these document coordinates.
    const measurements = contents.map(content => {
      const contentStyle = getComputedStyle(content);
      const details = content.querySelector(".project-details-button");
      const inFlow = !details || getComputedStyle(details).position !== "absolute";
      const footerSpace = inFlow ? parseFloat(contentStyle.getPropertyValue("--project-footer-space")) || 0 : 0;
      const contentHeight = parseFloat(contentStyle.height) - footerSpace;
      const preview = content.querySelector(".project-card-preview");
      // Short summaries still need room for the photo and the details button
      // below it, even though the button does not occupy a desktop grid row.
      let minimumHeight = !inFlow && preview
        ? Math.max(contentHeight, preview.offsetTop + preview.offsetHeight + details.offsetHeight
          + 8 + parseFloat(contentStyle.paddingBottom))
        : contentHeight;
      if (!inFlow) {
        const buttonLeft = details.getBoundingClientRect().left;
        for (const badge of content.querySelectorAll(".project-box-tags li")) {
          if (badge.getBoundingClientRect().right > buttonLeft) {
            minimumHeight = Math.max(minimumHeight, badge.offsetTop + badge.offsetHeight
              + details.offsetHeight + 8 + parseFloat(contentStyle.paddingBottom));
          }
        }
      }
      return { contentHeight, minimumHeight };
    });
    const firstRow = Math.ceil(projectsTop / unit - 0.001);

    setLength(projects.style, "--projects-grid-offset", Math.max(0, firstRow * unit - projectsTop));
    heightRules.forEach((rule, index) => {
      const { contentHeight, minimumHeight } = measurements[index];
      const rows = Math.ceil((minimumHeight + 2 * inset) / unit - 0.001);
      setLength(rule.style, "--project-grid-height", rows * unit);
      const footerSpace = Math.max(0, rows * unit - 2 * inset - contentHeight);
      const previousSpace = parseFloat(rule.style.getPropertyValue("--project-footer-space"));
      // Layout rounds to fractional CSS pixels. Ignore subpixel noise so
      // ResizeObserver cannot repeatedly nudge the footer by a rounding error.
      if (!Number.isFinite(previousSpace) || Math.abs(footerSpace - previousSpace) > 0.02) {
        setLength(rule.style, "--project-footer-space", footerSpace);
      }
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
