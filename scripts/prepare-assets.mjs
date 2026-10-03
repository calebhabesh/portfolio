import { beginBuild, invalidateBuild, run, runCachedGenerator } from "./build-cache.mjs";

// Static React markup is inexpensive and must follow every content/component edit.
await invalidateBuild();
await run(process.execPath, ["scripts/generate-static-projects.mjs"]);
for (const step of [
  {
    name: "collision", script: "scripts/generate-collision-field.mjs",
    inputs: ["models/emblem/lion_emblem.optimized.glb", "src/grass-field.js", "src/collision-field.js"],
    outputs: ["models/emblem/emblem-collision-field.bin"],
  },
  {
    name: "emblem", script: "scripts/pack-emblem-assets.mjs",
    inputs: ["models/emblem/lion_emblem.optimized.glb", "models/emblem/emblem-collision-field.bin"],
    outputs: ["src/assets/lion_emblem.optimized.glb.gzip", "src/assets/emblem-collision-field.bin.gzip"],
  },
  {
    name: "textures", script: "scripts/generate-emblem-textures.mjs",
    inputs: ["models/emblem/lion_emblem.optimized.glb", "src/emblem-textures.js"],
    outputs: ["src/assets/emblem-textures"],
  },
  {
    name: "paper", script: "scripts/generate-paper-grain.mjs",
    inputs: ["src/assets/paper-grain.svg"], outputs: ["src/assets/paper-grain.webp"],
  },
]) await runCachedGenerator(step);
await beginBuild();
