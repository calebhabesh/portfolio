import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const output = new URL("../src/assets/", import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ["lion_emblem.optimized.glb", "emblem-collision-field.bin"]) {
  const source = await readFile(new URL(`../${name}`, import.meta.url));
  const packed = gzipSync(source, { level: 9 });
  // Explicit payload compression works on static hosts without server configuration.
  await writeFile(new URL(`${name}.gzip`, output), packed);
  console.log(`${name}: ${source.length} → ${packed.length} bytes`);
}
