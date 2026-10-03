import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import sharp from "sharp";

const port = await new Promise((resolve) => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close(() => resolve(port));
  });
});
const baseUrl = process.env.PORTFOLIO_TEST_URL || `http://127.0.0.1:${port}`;
const server = process.env.PORTFOLIO_TEST_URL ? undefined : spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: new URL("../", import.meta.url), stdio: "ignore",
});
let browser;

async function checkGridVisibility(page, minimumContrast = 16) {
  const unit = await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue("--grid-unit")));
  // Sample the exposed outer gutter, away from maze walls and content.
  // Compare actual rendered pixels with the same page's grid switched off.
  const clip = { x: Math.round(unit * 0.4), y: 1, width: 3, height: 998 };
  const visible = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer();
  let hidden;
  try {
    await page.evaluate(() => document.documentElement.style.setProperty("--grid-line", "transparent"));
    hidden = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer();
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty("--grid-line"));
  }
  const contrast = Math.max(...visible.map((value, index) => Math.abs(value - hidden[index])));
  assert.ok(contrast >= minimumContrast, `The background grid must remain visible in both themes and at browser zoom (pixel contrast: ${contrast}/255).`);
}

async function checkGrid(page) {
  await page.evaluate(() => document.fonts.ready);
  // Let ResizeObserver settle the new unit, natural text heights, and rows
  // after a responsive breakpoint or project dialog closes.
  await page.evaluate(() => new Promise(resolve => {
    let remaining = 5;
    const frame = () => --remaining ? requestAnimationFrame(frame) : resolve();
    requestAnimationFrame(frame);
  }));
  const geometry = await page.evaluate(() => {
    const rect = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y: y + scrollY, width, height };
    };
    const body = getComputedStyle(document.body);
    return {
      shell: rect(document.querySelector(".page-shell")),
      header: rect(document.querySelector(".site-header")),
      brand: rect(document.querySelector(".brand")),
      logo: rect(document.querySelector(".calling-card-avatar")),
      toggle: rect(document.querySelector(".theme-toggle")),
      themeIcon: rect(document.querySelector(".theme-icon")),
      headerControls: [...document.querySelectorAll(".header-nav > a, .header-nav > button")].map(control => ({
        ...rect(control), icon: rect(control.querySelector("svg")), label: control.getAttribute("aria-label"),
        text: control.textContent.trim(), background: getComputedStyle(control).backgroundColor,
      })),
      sectionHeader: rect(document.querySelector(".project-section-header")),
      search: rect(document.querySelector(".project-search-field")),
      columns: Number(body.getPropertyValue("--grid-columns")),
      row: parseFloat(body.backgroundSize.split(",")[2].trim().split(" ").at(-1)),
      origin: parseFloat(body.backgroundPosition.split(",")[2].trim().split(" ").at(-1)),
      columnOrigin: parseFloat(body.backgroundPosition.split(",")[1].trim().split(" ")[0]),
      attachment: body.backgroundAttachment,
      photo: rect(document.querySelector(".hero-headshot")),
      photoCorners: [...document.querySelectorAll(".headshot-frame .project-frame-corner")].map(corner => {
        const bounds = rect(corner);
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      }),
      name: rect(document.querySelector(".hero-name")),
      nameLine: rect(document.querySelector(".hero-name-line")),
      ethiopic: rect(document.querySelector(".hero-name .brand-script")),
      nameFontSize: parseFloat(getComputedStyle(document.querySelector(".hero-name")).fontSize),
      ethiopicFontSize: parseFloat(getComputedStyle(document.querySelector(".hero-name .brand-script")).fontSize),
      frames: [...document.querySelectorAll(".project-frame")].map(frame => ({
        ...rect(frame), inset: parseFloat(getComputedStyle(frame).paddingTop), surface: rect(frame.querySelector(".project-box")),
        footer: rect(frame.querySelector(".project-details-button")),
        bottomPadding: parseFloat(getComputedStyle(frame.querySelector(".project-box-inner")).paddingBottom),
        corners: [...frame.querySelectorAll(".project-frame-corner")].map(corner => {
          const bounds = rect(corner);
          return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        }),
      })),
    };
  });
  const unit = geometry.row;
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.75,
    `${message}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
  const edge = geometry.shell.x + geometry.shell.width;
  near(geometry.origin, 0, "Background rows must start at document y=0");
  const attachments = geometry.attachment.split(",").map(value => value.trim());
  assert.deepEqual(attachments, ["fixed", "scroll", "scroll", "fixed"], "Grid rows must scroll with the crosses");
  near(geometry.shell.x, geometry.columnOrigin + Math.round((geometry.shell.x - geometry.columnOrigin) / unit) * unit,
    "Centered content must start on a grid column");
  assert.ok(unit >= 45 && unit <= 60, "Mobile and desktop must keep similar, spacious cell sizes");
  near(geometry.header.x, geometry.shell.x, "Header must share the project frames' left edge");
  near(geometry.header.x + geometry.header.width, edge, "Header must share the project frames' right edge");
  near(geometry.brand.x, geometry.shell.x, "Brand must start on the left guide");
  near(geometry.logo.x, geometry.shell.x, "Logo must start on the left guide");
  near(geometry.brand.y + geometry.brand.height / 2, unit / 2, "Brand must be centered in grid row zero");
  assert.equal(geometry.headerControls.length, 4, "Header must contain three contact links and the theme toggle");
  const controlRow = 0;
  for (const control of geometry.headerControls) {
    near(control.width, unit, "Header control must fill one grid column");
    near(control.height, unit, "Header control must fill one grid row");
    near(control.y, controlRow, "Header controls must share row zero with the brand");
    near(control.x, geometry.columnOrigin + Math.round((control.x - geometry.columnOrigin) / unit) * unit,
      "Header control must start on a grid column");
    near(control.icon.x + control.icon.width / 2, control.x + unit / 2, "Control icon must be horizontally centered");
    near(control.icon.y + control.icon.height / 2, control.y + unit / 2, "Control icon must be vertically centered");
    assert.ok(control.label, "Icon-only controls must have accessible names");
    assert.equal(control.text, "", "Header cells must remain icon-only");
    assert.notEqual(control.background, "rgba(0, 0, 0, 0)", "Header cells must have a subtle resting shade");
  }
  near(geometry.sectionHeader.y, Math.round(geometry.sectionHeader.y / unit) * unit,
    "Selected Projects must start on a grid row after the social row is removed");
  near(geometry.search.y, Math.round(geometry.search.y / unit) * unit, "Search must start on a grid row");
  near(geometry.search.height, unit, "Search must occupy one grid row");
  near(geometry.search.x, geometry.columnOrigin + Math.round((geometry.search.x - geometry.columnOrigin) / unit) * unit, "Search must start on a grid column");
  if (page.viewportSize().width <= 640) {
    near(geometry.frames[0].y, geometry.search.y + 2 * unit, "Mobile cards must leave one empty row below search");
  }
  near(geometry.themeIcon.x + geometry.themeIcon.width / 2, geometry.toggle.x + geometry.toggle.width / 2,
    "Theme icon must be centered in its hover target");
  near(geometry.themeIcon.y + geometry.themeIcon.height / 2, geometry.toggle.y + geometry.toggle.height / 2,
    "Theme icon must be vertically centered in its hover target");
  near(geometry.toggle.x + geometry.toggle.width, edge, "Theme button must stay within the right guide");
  assert.ok(geometry.brand.y + geometry.brand.height <= geometry.headerControls[0].y + 0.75 ||
    geometry.brand.x + geometry.brand.width <= geometry.headerControls[0].x,
    "Brand and header controls must not overlap");
  assert.ok(geometry.toggle.width >= 44 && geometry.toggle.height >= 44, "Theme toggle must keep its accessible touch target");
  for (const frame of geometry.frames) {
    for (const corner of frame.corners) {
      const column = (corner.x - geometry.columnOrigin) / unit;
      const row = (corner.y - geometry.origin) / geometry.row;
      near(corner.y, geometry.origin + Math.round(row) * geometry.row, "Cross must meet a background row");
      near(corner.x, geometry.columnOrigin + Math.round(column) * unit, "Cross must meet a background column");
    }
    assert.ok(frame.inset > 0 && frame.inset <= 8, "Card must reserve a small amount of room for tilt");
    near(frame.x + frame.inset, frame.surface.x, "Card must have an even horizontal inset");
    near(frame.y + frame.inset, frame.surface.y, "Card must have an even vertical inset");
    near(frame.width - 2 * frame.inset, frame.surface.width, "Card width must fill the inset area");
    near(frame.height - 2 * frame.inset, frame.surface.height, "Card height must fill the inset area");
    near(frame.surface.y + frame.surface.height - frame.footer.y - frame.footer.height,
      frame.bottomPadding, "Details button must keep a consistent bottom inset instead of a spare grid row");
  }
  near(geometry.photo.width, 2 * unit, "Portrait must span two grid columns");
  near(geometry.photo.height, geometry.photo.width, "Portrait must remain square");
  near(geometry.photo.y, Math.round(geometry.photo.y / unit) * unit, "Portrait must start on a zero-origin grid row");
  near(geometry.name.y + geometry.name.height / 2, geometry.photo.y + geometry.photo.height / 2, "Name must remain centered beside the portrait");
  near(geometry.name.height, geometry.photo.height, "Name stack must match the portrait height");
  near(geometry.nameLine.y, geometry.photo.y, "Name must occupy the first portrait row");
  near(geometry.nameLine.height, unit, "Name must occupy one grid row");
  near(geometry.ethiopic.y, geometry.photo.y + unit, "Ethiopic text must occupy the second portrait row");
  near(geometry.ethiopic.height, unit, "Ethiopic text must occupy one grid row");
  if (page.viewportSize().width <= 768) {
    assert.ok(geometry.nameFontSize <= unit * 0.65 + 0.1, "Mobile name must use a smaller font size");
    near(geometry.photo.y, geometry.header.y + geometry.header.height + unit, "Mobile portrait must leave one empty grid row below the header");
  } else {
    near(geometry.nameFontSize, unit * 0.9, "Name font size must be 90% of its grid row");
  }
  near(geometry.ethiopicFontSize, geometry.nameFontSize * 0.65, "Ethiopic text must remain smaller than the name");
  assert.equal(geometry.photoCorners.length, 4, "Portrait must have four mini crosses");
  for (const [index, corner] of geometry.photoCorners.entries()) {
    near(corner.x, geometry.photo.x + (index % 2) * geometry.photo.width, "Portrait cross must meet its column vertex");
    near(corner.y, geometry.photo.y + Math.floor(index / 2) * geometry.photo.height, "Portrait cross must meet its row vertex");
  }
}

try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    if (attempt > 100) throw new Error("Preview server did not start.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
    // Isolate layout from the independent WebGL scene.
    await page.route(/\/emblem-scene(?:-[^/]+)?\.js(?:\?.*)?$/, route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    await checkGridVisibility(page);
    for (const zoom of [0.8, 0.9, 1.1, 1.25]) {
      // Fractional scaling previously rounded both half-pixel gradient
      // stops away, even though background-image still reported a grid.
      await page.evaluate(zoom => { document.body.style.zoom = zoom; }, zoom);
      await checkGridVisibility(page, 12);
    }
    await page.evaluate(() => {
      document.body.style.removeProperty("zoom");
      return new Promise(resolve => {
        let remaining = 5;
        const frame = () => --remaining ? requestAnimationFrame(frame) : resolve();
        requestAnimationFrame(frame);
      });
    });
    for (const width of [2048, 1440, 1024, 991, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.mouse.move(0, 0);
      await checkGrid(page);
      await page.evaluate(() => window.scrollTo({ top: 113, behavior: "instant" }));
      await checkGrid(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await checkGrid(page);
      const details = page.locator(".project-details-button").first();
      assert.ok((await details.boundingBox()).height >= 44, "Details must have a usable touch target.");
      const before = await page.locator(".project-frame").evaluateAll(frames => frames.map(frame => frame.offsetHeight));
      const pageHeight = await page.evaluate(() => document.body.getBoundingClientRect().height);
      await details.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /Project Notes/i);
      assert.match(await dialog.innerText(), /Custom Hardware/);
      assert.equal(await page.evaluate(() => document.body.getBoundingClientRect().height), pageHeight,
        "Opening details must preserve the document height.");
      assert.deepEqual(await page.locator(".project-frame").evaluateAll(frames => frames.map(frame => frame.offsetHeight)), before,
        "Opening details must preserve every card's height.");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await details.evaluate(button => button === document.activeElement), true,
        "Closing details must return keyboard focus to its button.");
      await page.mouse.move(0, 0);
      await checkGrid(page);
    }
    await page.close();
  }
  console.log("Zero-origin blueprint coordinates passed in both themes at seven widths, including resize, details discovery, and stable page height.");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
