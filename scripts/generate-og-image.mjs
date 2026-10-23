// Renders the link-preview card (public/og-image.jpg) and updates its
// cache-busting ?v= in index.html. Rerun after adding a project or
// changing a card sketch:  npm run generate:og
//
// The card reuses the site's dark blueprint grid, the lion mark, and each
// project's sketch in its card colour, read straight from the source.
// The Ge'ez name needs "Noto Sans Ethiopic" installed on this machine.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const dataUri = async (path, type) =>
  `data:${type};base64,${(await readFile(new URL(path, root))).toString("base64")}`;

const [sketchSource, css, projects, html] = await Promise.all([
  read("src/components/ProjectSketch.tsx"),
  read("src/styles.css"),
  read("src/data/projects.ts"),
  read("index.html"),
]);

const sketches = {};
for (const m of sketchSource.matchAll(
  /"?([\w-]+)"?: \{\s*(?:\/\/[^\n]*\n\s*)?outline: "([^"]+)",\s*detail: "([^"]+)",(?:\s*weight: ([\d.]+),)?/g,
)) {
  sketches[m[1]] = { outline: m[2], detail: m[3], weight: m[4] || 1.35 };
}

// Projects in site order, each drawn in its card's bright light-theme
// paper colour, which stays vivid against the dark grid.
const tiles = [...projects.matchAll(/^ {4}id: "([^"]+)",\n {4}tone: "(\w+)"/gm)].map(([, id, tone]) => {
  const sketch = sketches[id];
  if (!sketch) throw new Error(`No sketch found for project "${id}"`);
  const block = css.match(new RegExp(`\\n\\[data-project-tone="${tone}"\\] \\{([^}]+)\\}`))?.[1];
  if (!block) throw new Error(`No light colours found for tone "${tone}"`);
  const color = (name) => block.match(new RegExp(`--${name}: (#[0-9a-f]+)`))[1];
  return `<div class="tile" style="color:${color("surface-bottom")}">
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="${sketch.weight}" stroke-linecap="round" stroke-linejoin="round">
      <g transform="rotate(-5 20 20)">
        <path d="${sketch.outline}"/>
        <path d="${sketch.outline}" stroke-width="0.65" opacity="0.35" transform="translate(0.55 -0.4)"/>
        <path d="${sketch.detail}"/>
      </g>
    </svg></div>`;
});
if (tiles.length === 0) throw new Error("No projects found in src/data/projects.ts");

const [font, lion] = await Promise.all([
  dataUri("public/fonts/satoshi-variable.woff2", "font/woff2"),
  dataUri("public/lion-mark.svg", "image/svg+xml"),
]);

// 1200×627 at 2× gives LinkedIn's preferred 1.91:1 at 2400×1254.
// Grid squares are 60px; horizontal lines fall at y = 27 + 60k so one sits
// 10px under the name's baseline at y = 267, and the tiles fill 387–447.
const card = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Satoshi;src:url(${font}) format("woff2");font-weight:300 900}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:627px;overflow:hidden}
body{--u:60px;--gy:27px;--grid-line:rgba(224,239,232,.1);--vignette-edge:rgba(0,0,0,.48);--vignette-center:rgba(138,180,150,.1);
  font-family:Satoshi,sans-serif;background-color:#121b16;color:#f1eee5;position:relative}
body::before{content:"";position:absolute;inset:0;filter:blur(.6px);
  background-image:radial-gradient(ellipse 80% 75% at 50% 40%,transparent 28%,var(--vignette-edge) 100%),
    linear-gradient(to right,var(--grid-line) 0 1px,transparent 1px),
    linear-gradient(to bottom,var(--grid-line) 0 1px,transparent 1px),
    radial-gradient(ellipse 75% 70% at 50% 38%,var(--vignette-center),transparent 80%);
  background-size:100% 100%,var(--u) var(--u),var(--u) var(--u),100% 100%;
  background-position:0 0,0 0,0 var(--gy),0 0}
.lion{position:absolute;right:-55px;top:50%;transform:translateY(-50%) rotate(-6deg);height:480px;filter:drop-shadow(0 20px 40px #0008)}
h1{position:absolute;left:120px;font-size:96px;font-weight:800;letter-spacing:-.035em;line-height:1;white-space:nowrap}
.script{position:absolute;left:120px;top:282px;font-family:"Noto Sans Ethiopic",sans-serif;color:#b9c5b9;font-weight:500;font-size:42px;line-height:1.3}
.tiles{position:absolute;left:120px;top:387px;display:flex}
.tile{width:60px;height:60px;display:grid;place-items:center}
.tile svg{width:54px;height:54px}
</style>
<img class="lion" src="${lion}" alt="">
<h1 id="name">Caleb Habesh<i id="baseline" style="display:inline-block;width:0;height:0"></i></h1>
<div class="script">ካሌብ ሐበሽ</div>
<div class="tiles">${tiles.join("")}</div>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
});
let png;
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 627 }, deviceScaleFactor: 2 });
  await page.setContent(card, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Place the name so its baseline sits 10px above the y=267 grid line.
    const name = document.getElementById("name");
    const baseline = document.getElementById("baseline").getBoundingClientRect().top - name.getBoundingClientRect().top;
    name.style.top = `${257 - baseline}px`;
  });
  png = await page.screenshot();
} finally {
  await browser.close();
}

const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
await writeFile(new URL("public/og-image.jpg", root), jpg);

const version = createHash("sha256").update(jpg).digest("hex").slice(0, 12);
const updated = html.replace(/og-image\.jpg\?v=[0-9a-f]+/, `og-image.jpg?v=${version}`);
if (updated === html && !html.includes(`og-image.jpg?v=${version}`)) {
  throw new Error("Could not find og-image.jpg?v= in index.html");
}
await writeFile(new URL("index.html", root), updated);
console.log(`Wrote public/og-image.jpg (${(jpg.length / 1024).toFixed(0)} KB, v=${version})`);
