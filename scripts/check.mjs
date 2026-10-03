import { performance } from "node:perf_hooks";
import { currentBuild, markVerified, run, verifiedBuild } from "./build-cache.mjs";

const flags = process.argv.slice(2);
if (flags.some(flag => !["--full", "--reuse"].includes(flag))) {
  console.error("Usage: node scripts/check.mjs [--full] [--reuse]");
  process.exit(1);
}
const suite = flags.includes("--full") ? "full" : "quick";
const started = performance.now();
async function timed(label, command, args) {
  const start = performance.now();
  console.log(`\nChecking ${label}…`);
  await run(command, args);
  console.log(`${label}: ${((performance.now() - start) / 1000).toFixed(1)}s`);
}

try {
  if (flags.includes("--reuse") && await verifiedBuild(undefined, suite)) {
    console.log(`Reusing the verified ${suite} build: source and dist contents match.`);
  } else {
    await timed("build", "npm", ["run", "build"]);
    const build = await currentBuild();
    if (!build) throw new Error("Build is missing or changed before verification.");
    for (const script of ["test-build-workflow", "test-technology-search", "test-quick"]) {
      await timed(script, process.execPath, [`scripts/${script}.mjs`]);
    }
    if (suite === "full") {
      for (const script of [
        "test-blueprint-grid", "test-load-scroll", "test-grid-pointer-trail", "test-paper-grain",
        "test-maze-pathfinding", "test-gutter-maze", "test-startup-performance", "test-card-interaction",
        "test-search-expansion", "test-project-search", "test-footer-signature", "smoke",
      ]) await timed(script, process.execPath, [`scripts/${script}.mjs`]);
    }
    // No passing receipt is written when any command above fails.
    await markVerified("quick", build);
    if (suite === "full") await markVerified("full", build);
    console.log(`\n${suite} checks passed in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
