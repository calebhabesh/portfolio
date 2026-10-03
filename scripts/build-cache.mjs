import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
const cacheDirectory = ".artifacts/build";
const sourcePaths = [
  "index.html", "src", "public", "scripts", "package.json", "package-lock.json",
  "vite.config.js", "tsconfig.json", "models/emblem/lion_emblem.optimized.glb",
];

export async function fingerprint(paths, root = ROOT) {
  const hash = createHash("sha256").update(process.version);
  async function visit(path) {
    let entries;
    try {
      entries = await readdir(join(root, path));
    } catch (error) {
      if (error.code !== "ENOTDIR") throw error;
      const contents = await readFile(join(root, path));
      hash.update(JSON.stringify([path, contents.length])).update(contents);
      return;
    }
    hash.update(JSON.stringify([path, entries.sort()]));
    for (const entry of entries) await visit(join(path, entry));
  }
  for (const path of [...paths].sort()) await visit(path);
  return hash.digest("hex");
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, path);
}

export function run(command, args, root = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0
      ? resolve()
      : reject(new Error(`${command} ${args.join(" ")} exited with ${signal || code}.`)));
  });
}

export async function runCachedGenerator(step, root = ROOT) {
  const inputs = [step.script, "scripts/build-cache.mjs", "package.json", "package-lock.json", ...step.inputs];
  const inputHash = await fingerprint(inputs, root);
  const path = join(root, cacheDirectory, `${step.name}.json`);
  const cached = await readJson(path);
  let outputHash;
  try {
    outputHash = await fingerprint(step.outputs, root);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (typeof outputHash === "string" && cached?.inputs === inputHash && cached?.outputs === outputHash) {
    console.log(`Cached ${step.name}: inputs and outputs unchanged.`);
    return false;
  }
  // Failed or interrupted generation must never leave a reusable entry.
  await rm(path, { force: true });
  await run(process.execPath, [step.script], root);
  if (await fingerprint(inputs, root) !== inputHash) throw new Error(`${step.name} inputs changed during generation.`);
  await writeJson(path, { inputs: inputHash, outputs: await fingerprint(step.outputs, root) });
  return true;
}

export async function invalidateBuild(root = ROOT) {
  await rm(join(root, cacheDirectory, "build.json"), { force: true });
  await rm(join(root, cacheDirectory, "pending.json"), { force: true });
}

export async function beginBuild(root = ROOT) {
  await invalidateBuild(root);
  await writeJson(join(root, cacheDirectory, "pending.json"), { source: await fingerprint(sourcePaths, root) });
}

export async function finishBuild(root = ROOT) {
  const pending = await readJson(join(root, cacheDirectory, "pending.json"));
  const source = await fingerprint(sourcePaths, root);
  if (pending?.source !== source) throw new Error("Source changed during the build; rebuild before verification.");
  const build = { source, output: await fingerprint(["dist"], root), verified: [] };
  await writeJson(join(root, cacheDirectory, "build.json"), build);
  await rm(join(root, cacheDirectory, "pending.json"), { force: true });
  return build;
}

export async function currentBuild(root = ROOT) {
  const build = await readJson(join(root, cacheDirectory, "build.json"));
  if (!build || !Array.isArray(build.verified)) return null;
  try {
    if (build.source !== await fingerprint(sourcePaths, root) || build.output !== await fingerprint(["dist"], root)) return null;
    // A removed entry point cannot qualify, even if a partial build was recorded.
    await readFile(join(root, "dist/index.html"));
    await readdir(join(root, "dist/assets"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  return build;
}

export async function verifiedBuild(root = ROOT, suite = "quick") {
  const build = await currentBuild(root);
  return build?.verified.includes(suite) ? build : null;
}

export async function markVerified(suite, expected, root = ROOT) {
  const build = await currentBuild(root);
  if (!build || build.source !== expected.source || build.output !== expected.output) {
    throw new Error("Source or build output changed during verification; run checks again.");
  }
  build.verified = [...new Set([...build.verified, suite])];
  await writeJson(join(root, cacheDirectory, "build.json"), build);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "--record") throw new Error("Expected --record (used by npm postbuild).");
    await finishBuild();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
