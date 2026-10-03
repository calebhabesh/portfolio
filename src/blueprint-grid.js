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
  const results = projects.querySelector(".project-search-results");
  if (!results) return;
  const sectionHeader = projects.querySelector(".project-section-header");
  const technologyLoop = document.querySelector(".technology-loop");

  const frames = [...projects.querySelectorAll(".project-frame")];
  const contents = frames.map(frame => frame.querySelector(".project-box-inner"));
  const originalIds = frames.map(frame => frame.querySelector("[data-project]")?.dataset.project);
  let measuredWidth;
  let slotHeights = [];
  // Keep measured styles outside React's hydrated markup. Changing inline
  // attributes on the static cards before hydration would produce mismatches.
  const style = document.createElement("style");
  style.dataset.blueprintGrid = "";
  style.textContent = frames.map((frame, index) =>
    `.project-card-animate[data-card-index="${index}"] { --project-grid-height: auto; }`,
  ).join("\n") + "\n.project-search-results { --projects-grid-offset: 0px; }";
  document.head.append(style);
  const heightRules = [...style.sheet.cssRules].slice(0, frames.length);
  const offsetRule = style.sheet.cssRules[frames.length];
  let scheduled;

  const setLength = (declaration, name, value) => {
    // Dev styles can arrive after the initial measurement. Retain the last
    // valid geometry until fonts/styles or visible content trigger a resnap.
    if (!Number.isFinite(value)) return false;
    const length = `${value}px`;
    const previous = parseFloat(declaration.getPropertyValue(name));
    // Ignore layout's fractional-pixel noise when settling a new grid size.
    if (Number.isFinite(previous) && Math.abs(previous - value) < 0.02) return false;
    declaration.setProperty(name, length);
    return true;
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
    let geometryChanged = [
      setLength(root.style, "--grid-unit", unit),
      setLength(root.style, "--page-width", contentColumns * unit),
      setLength(root.style, "--grid-origin-x", mobile ? gutter : 0),
      setLength(root.style, "--portrait-unit", unit),
      setLength(root.style, "--project-grid-gap", unit),
    ].some(Boolean);

    // Snap the portrait's final document position to a zero-origin row.
    // Subtract both the previous correction and the entrance transform to
    // avoid a feedback loop or following the animated visual position.
    const transform = getComputedStyle(heroCopy).transform;
    const entranceY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    const oldOffset = parseFloat(hero.style.getPropertyValue("--hero-grid-offset")) || 0;
    const naturalTop = portrait.getBoundingClientRect().top + window.scrollY - entranceY - oldOffset;
    geometryChanged = setLength(hero.style, "--hero-grid-offset", Math.max(0, Math.ceil(naturalTop / unit - 0.001) * unit - naturalTop)) || geometryChanged;
    if (sectionHeader) {
      // Keep the heading/search row on a grid line using the hero's trailing
      // space, independent of the introduction's length or mobile stacking.
      const heroSpace = parseFloat(getComputedStyle(hero).paddingBottom);
      const headerTransform = getComputedStyle(sectionHeader).transform;
      const headerY = headerTransform === "none" ? 0 : new DOMMatrixReadOnly(headerTransform).m42;
      const headerTop = sectionHeader.getBoundingClientRect().top + window.scrollY - headerY;
      const naturalHeaderTop = headerTop - (heroSpace - unit / 2);
      const correction = Math.max(0, Math.ceil(naturalHeaderTop / unit - 0.001) * unit - naturalHeaderTop);
      geometryChanged = setLength(hero.style, "--hero-projects-space", Math.round((unit / 2 + correction) * 64) / 64) || geometryChanged;
      if (technologyLoop) {
        const heroTop = hero.getBoundingClientRect().top + window.scrollY;
        const search = sectionHeader.querySelector(".project-search-field");
        const searchTop = search.getBoundingClientRect().top + window.scrollY - headerY;
        const searchRow = Math.floor(searchTop / unit + 0.001);
        // Use the existing empty row; the loop never changes section spacing.
        setLength(hero.style, "--technology-loop-top", (searchRow - 2) * unit - heroTop);
      }
    }
    const projectsTop = results.getBoundingClientRect().top + window.scrollY;
    // Snap the compact card to whole rows. Desktop details buttons use the
    // spare space beside the badges; mobile buttons keep their own row.
    // Expanded content never changes these document coordinates.
    const measurements = frames.map(frame => {
      const content = frame.querySelector(".project-box-inner");
      if (!content) return null;
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

    setLength(offsetRule.style, "--projects-grid-offset", Math.max(0, firstRow * unit - projectsTop));
    // A filtered subsequence can move later projects into earlier slots.
    // Reserve enough room for those projects before the first search, then
    // retain every slot's geometry through result swaps and empty states.
    const filtering = results.dataset.filtering === "true";
    const originalsRestored = frames.every((frame, index) => frame.querySelector("[data-project]")?.dataset.project === originalIds[index]);
    if ((!filtering && originalsRestored) || measuredWidth !== width) {
      slotHeights = frames.map((_, index) => {
        const minimum = Math.max(0, ...measurements.slice(index).map(value => value?.minimumHeight || 0));
        return Math.ceil((minimum + 2 * inset) / unit - 0.001) * unit;
      });
      measuredWidth = width;
    }
    heightRules.forEach((rule, index) => {
      setLength(rule.style, "--project-grid-height", slotHeights[index]);
      if (!measurements[index]) return;
      const { contentHeight } = measurements[index];
      const footerSpace = Math.max(0, slotHeights[index] - 2 * inset - contentHeight);
      const previousSpace = parseFloat(rule.style.getPropertyValue("--project-footer-space"));
      // Layout rounds to fractional CSS pixels. Ignore subpixel noise so
      // ResizeObserver cannot repeatedly nudge the footer by a rounding error.
      if (!Number.isFinite(previousSpace) || Math.abs(footerSpace - previousSpace) > 0.02) {
        setLength(rule.style, "--project-footer-space", footerSpace);
      }
    });
    // Inherited grid dimensions and hero spacing can finish resolving after
    // this measurement. Recheck once they settle, even if their final sizes
    // do not trigger another ResizeObserver notification.
    if (geometryChanged) schedule();
  };

  const schedule = () => { scheduled ??= requestAnimationFrame(update); };
  const resnap = () => {
    cancelAnimationFrame(scheduled);
    update();
  };
  const observer = new ResizeObserver(schedule);
  // Observe natural content, not the snapped frames: otherwise changing a
  // frame height would feed its own rounded height back into the calculation.
  [shell, document.querySelector(".hero"), heroCopy, sectionHeader, ...contents].filter(Boolean).forEach(element => observer.observe(element));
  const contentObserver = new MutationObserver(schedule);
  contentObserver.observe(results, { childList: true, subtree: true });
  window.addEventListener("portfolio:project-filter", resnap);
  window.addEventListener("resize", schedule, { passive: true });
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener("loadingdone", schedule);
  update();

  return () => {
    observer.disconnect();
    contentObserver.disconnect();
    style.remove();
    cancelAnimationFrame(scheduled);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("portfolio:project-filter", resnap);
    document.fonts.removeEventListener("loadingdone", schedule);
  };
}
