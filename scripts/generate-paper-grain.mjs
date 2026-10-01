import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Preserve the original paper artwork and filter, but bake the mirrored
// tile once. Firefox can leave hairline gaps between filtered SVG pieces.
const source = await readFile(new URL("../src/assets/paper-grain.svg", import.meta.url), "utf8");
const image = Buffer.from(source.match(/base64,([^"]+)/)[1], "base64");
const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const width = 472, height = 836;
const pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const sourceX = x < width / 2 ? x : width - 1 - x;
    const sourceY = y < height / 2 ? y : height - 1 - y;
    const index = (sourceY * info.width + sourceX) * info.channels;
    const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    const grain = Math.round(Math.max(0, Math.min(255, 2.1 * luminance - 1.43 * 255)));
    const target = (y * width + x) * 4;
    pixels[target] = pixels[target + 1] = pixels[target + 2] = grain;
    pixels[target + 3] = Math.round(255 * 0.36);
  }
}
const tile = await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true }).toBuffer();
await writeFile(new URL("../src/assets/paper-grain.webp", import.meta.url), tile);
console.log(`Generated seamless paper grain (${(tile.length / 1024).toFixed(1)} KiB).`);
