import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";

const port = await new Promise((resolve) => {
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

async function checkGrid(page) {
  await page.evaluate(() => document.fonts.ready);
  // Let ResizeObserver settle the new unit, natural text heights, and rows
  // after a responsive breakpoint or native Details toggle.
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
      columns: Number(body.getPropertyValue("--grid-columns")),
      row: parseFloat(body.backgroundSize.split(",")[2].trim().split(" ").at(-1)),
      origin: parseFloat(body.backgroundPosition.split(",")[2].trim().split(" ").at(-1)),
      photo: rect(document.querySelector(".hero-headshot")),
      photoCorners: [...document.querySelectorAll(".headshot-frame .project-frame-corner")].map(corner => {
        const bounds = rect(corner);
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      }),
      name: rect(document.querySelector(".hero-name")),
      frames: [...document.querySelectorAll(".project-frame")].map(frame => ({
        ...rect(frame), inset: parseFloat(getComputedStyle(frame).paddingTop), surface: rect(frame.querySelector(".project-box")),
        corners: [...frame.querySelectorAll(".project-frame-corner")].map(corner => {
          const bounds = rect(corner);
          return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        }),
      })),
    };
  });
  const unit = geometry.shell.width / geometry.columns;
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.75,
    `${message}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
  const edge = geometry.shell.x + geometry.shell.width;
  near(geometry.header.x, geometry.shell.x, "Header must share the project frames' left edge");
  near(geometry.header.x + geometry.header.width, edge, "Header must share the project frames' right edge");
  near(geometry.brand.x, geometry.shell.x, "Brand must start on the left guide");
  near(geometry.logo.x, geometry.shell.x, "Logo must start on the left guide");
  near(geometry.themeIcon.x + geometry.themeIcon.width, edge, "Theme icon must end on the right guide");
  near(geometry.toggle.x + geometry.toggle.width, edge, "Theme button must stay within the right guide");
  assert.ok(geometry.brand.x + geometry.brand.width <= geometry.toggle.x, "Header controls must not overlap");
  assert.ok(geometry.toggle.width >= 44 && geometry.toggle.height >= 44, "Theme toggle must keep its accessible touch target");
  for (const frame of geometry.frames) {
    for (const corner of frame.corners) {
      const column = (corner.x - geometry.shell.x) / unit;
      const row = (corner.y - geometry.origin) / geometry.row;
      near(corner.y, geometry.origin + Math.round(row) * geometry.row, "Cross must meet a background row");
      near(corner.x, geometry.shell.x + Math.round(column) * unit, "Cross must meet a background column");
    }
    assert.ok(frame.inset > 0 && frame.inset <= 8, "Card must reserve a small amount of room for tilt");
    near(frame.x + frame.inset, frame.surface.x, "Card must have an even horizontal inset");
    near(frame.y + frame.inset, frame.surface.y, "Card must have an even vertical inset");
    near(frame.width - 2 * frame.inset, frame.surface.width, "Card width must fill the inset area");
    near(frame.height - 2 * frame.inset, frame.surface.height, "Card height must fill the inset area");
  }
  near(geometry.row, unit, "Background cells must be square");
  near(geometry.photo.width, unit, "Portrait must fill one grid column");
  near(geometry.photo.height, unit, "Portrait must fill one grid row");
  near(geometry.name.y, geometry.photo.y, "Name must start in the portrait row");
  near(geometry.name.height, unit, "Name must occupy one grid row");
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
    await page.route("**/emblem-scene-*.js", route => route.abort());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('#projects-root[data-interactive="true"]').waitFor();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.mouse.move(0, 0);
      await checkGrid(page);
      const notes = page.locator(".project-notes").first();
      const before = await page.locator(".project-frame").first().boundingBox();
      await notes.locator("summary").click();
      await page.mouse.move(0, 0);
      await checkGrid(page);
      assert.ok((await page.locator(".project-frame").first().boundingBox()).height > before.height,
        "The frame must grow to whole rows when Notes opens.");
      await notes.locator("summary").click();
      await page.mouse.move(0, 0);
      await checkGrid(page);
    }
    await page.close();
  }
  console.log("Blueprint coordinates passed in both themes at five widths, including resize and Notes expansion.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
