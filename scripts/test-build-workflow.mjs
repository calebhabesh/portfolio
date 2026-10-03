import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beginBuild, finishBuild, markVerified, verifiedBuild, runCachedGenerator } from "./build-cache.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "portfolio-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "package.json": "{}", "package-lock.json": "{}", "vite.config.js": "", "tsconfig.json": "{}",
    "index.html": "source", "src/main.js": "source", "public/favicon.svg": "icon",
    "scripts/build-cache.mjs": "", "models/emblem/lion_emblem.optimized.glb": "model",
    "dist/index.html": "built", "dist/assets/main.js": "built",
    "input.txt": "first",
    "scripts/generate.mjs": `import { readFile, writeFile, appendFile } from 'node:fs/promises';
await writeFile('output.txt', await readFile('input.txt'));
await appendFile('runs.txt', 'run\\n');`,
  };
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

test("generators reuse identical content and regenerate changed or missing outputs", async t => {
  const root = await fixture(t);
  const step = { name: "fixture", script: "scripts/generate.mjs", inputs: ["input.txt"], outputs: ["output.txt"] };
  assert.equal(await runCachedGenerator(step, root), true);
  assert.equal(await runCachedGenerator(step, root), false);
  await writeFile(join(root, "input.txt"), "other");
  assert.equal(await runCachedGenerator(step, root), true);
  await writeFile(join(root, "output.txt"), "broken");
  assert.equal(await runCachedGenerator(step, root), true);
  await rm(join(root, "output.txt"));
  assert.equal(await runCachedGenerator(step, root), true);
  await writeFile(join(root, "package-lock.json"), '{"changed":true}');
  assert.equal(await runCachedGenerator(step, root), true);
  assert.equal((await readFile(join(root, "runs.txt"), "utf8")).trim().split("\n").length, 5);
});

test("a failed generator cannot leave a reusable cache entry", async t => {
  const root = await fixture(t);
  const step = { name: "fixture", script: "scripts/generate.mjs", inputs: ["input.txt"], outputs: ["output.txt"] };
  await runCachedGenerator(step, root);
  await writeFile(join(root, step.script), "process.exit(1);");
  await assert.rejects(runCachedGenerator(step, root), /exited/);
  await assert.rejects(runCachedGenerator(step, root), /exited/);
});

test("deployment reuses only a verified build with matching source and output", async t => {
  const root = await fixture(t);
  assert.equal(await verifiedBuild(root), null);
  await beginBuild(root);
  const build = await finishBuild(root);
  assert.equal(await verifiedBuild(root), null, "A build alone has no passing checks.");
  await markVerified("quick", build, root);
  assert.ok(await verifiedBuild(root));
  assert.equal(await verifiedBuild(root, "full"), null);
  await markVerified("full", build, root);
  assert.ok(await verifiedBuild(root, "full"));
  await writeFile(join(root, "public/favicon.svg"), "changed");
  assert.equal(await verifiedBuild(root), null);
  await assert.rejects(markVerified("quick", build, root), /changed/);
  await writeFile(join(root, "public/favicon.svg"), "icon");
  assert.ok(await verifiedBuild(root));
  await writeFile(join(root, "dist/assets/main.js"), "tampered");
  assert.equal(await verifiedBuild(root), null);
  await writeFile(join(root, "dist/assets/main.js"), "built");
  await rm(join(root, "dist/index.html"));
  assert.equal(await verifiedBuild(root), null);
});

test("starting or failing a new build invalidates the previous verification", async t => {
  const root = await fixture(t);
  await beginBuild(root);
  await markVerified("quick", await finishBuild(root), root);
  await beginBuild(root);
  assert.equal(await verifiedBuild(root), null);
  await writeFile(join(root, "src/main.js"), "edited during build");
  await assert.rejects(finishBuild(root), /changed/);
  assert.equal(await verifiedBuild(root), null);
});

test("the check runner retains every full-suite command, reuses verification, and stops on failure", async t => {
  const root = await fixture(t);
  for (const script of ["build-cache", "check"]) {
    await writeFile(join(root, `scripts/${script}.mjs`), await readFile(new URL(`./${script}.mjs`, import.meta.url)));
  }
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "node scripts/build.mjs" } }));
  await writeFile(join(root, "scripts/build.mjs"), `import { beginBuild, finishBuild } from './build-cache.mjs';
await beginBuild(); await finishBuild();`);
  const quick = ["test-build-workflow", "test-technology-search", "test-quick"];
  const full = [...quick, "test-blueprint-grid", "test-load-scroll", "test-grid-pointer-trail", "test-paper-grain",
    "test-maze-pathfinding", "test-gutter-maze", "test-startup-performance", "test-card-interaction",
    "test-search-expansion", "test-project-search", "test-footer-signature", "smoke"];
  for (const script of full) {
    await writeFile(join(root, `scripts/${script}.mjs`), `import { appendFile } from 'node:fs/promises';
await appendFile('checks.txt', '${script}\\n');`);
  }
  const execute = promisify(execFile);
  const check = (...flags) => execute(process.execPath, ["scripts/check.mjs", ...flags], { cwd: root });
  const checked = async () => (await readFile(join(root, "checks.txt"), "utf8")).trim().split("\n");
  await check();
  assert.deepEqual(await checked(), quick);
  await check("--reuse");
  assert.deepEqual(await checked(), quick, "Reuse should launch no tests or build.");
  await writeFile(join(root, "checks.txt"), "");
  await check("--full");
  assert.deepEqual(await checked(), full, "Every old full-suite check must still run.");
  assert.ok(await verifiedBuild(root, "full"));
  await check("--full", "--reuse");
  assert.deepEqual(await checked(), full);
  await writeFile(join(root, "scripts/test-quick.mjs"), "process.exit(1);");
  await assert.rejects(check("--reuse"));
  assert.equal(await verifiedBuild(root), null, "Failed checks cannot qualify for deployment.");
  assert.equal(await verifiedBuild(root, "full"), null);
});
