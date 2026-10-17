import { mkdir, readdir, rm } from "node:fs/promises";
import sharp from "sharp";

// Each card gets its own crumple sheet. Creases are scattered uniformly, so
// every sheet has the same density and no sheet looks more worn than another.
const CRUMPLE_VARIANTS = 8;
const width = 960, height = 460;
const output = new URL("../src/assets/paper-crumple/", import.meta.url);

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Crumpled paper is a mesh of flat facets joined by straight creases. Each
// octave is a jittered Voronoi sheet whose borders fold, so every cell rises
// into a faceted pyramid. Octaves are [cell size, crease depth].
const octaves = [[200, 1], [96, 0.66], [46, 0.46], [21, 0.3], [9, 0.13]];

function hash(seed, x, y, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

async function crumple(seed) {
  const next = random(seed);
  const heightField = new Float32Array(width * height);
  // A gentle warp keeps creases from looking ruled.
  const waves = Array.from({ length: 6 }, () => [next() * 0.02 + 0.004, next() * Math.PI * 2, next() * Math.PI]);
  for (const [size, depth] of octaves) {
    const octaveSeed = Math.floor(next() * 1e9);
    // Stretching each octave along its own direction elongates the creases.
    const angle = next() * Math.PI, along = [Math.cos(angle), Math.sin(angle)], stretch = 1.5 + next() * 0.5;
    const fold = next() < 0.5 ? -depth : depth;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let wx = x, wy = y;
        for (const [frequency, phase, waveAngle] of waves) {
          const t = Math.sin((x * Math.cos(waveAngle) + y * Math.sin(waveAngle)) * frequency + phase);
          wx += t * size * 0.035;
          wy -= t * size * 0.035;
        }
        const u = (wx * along[0] + wy * along[1]) / stretch, v = wy * along[0] - wx * along[1];
        const gx = Math.floor(u / size), gy = Math.floor(v / size);
        let f1 = Infinity, f2 = Infinity;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const cx = gx + ox, cy = gy + oy;
            const distance = Math.hypot(u - (cx + hash(octaveSeed, cx, cy, 1)) * size, v - (cy + hash(octaveSeed, cx, cy, 2)) * size);
            if (distance < f1) { f2 = f1; f1 = distance; } else if (distance < f2) f2 = distance;
          }
        }
        heightField[y * width + x] += fold * (f2 - f1);
      }
    }
  }

  // Light the folded surface from the upper left.
  const shade = new Float32Array(width * height);
  let sum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = heightField[y * width + Math.max(0, x - 1)], right = heightField[y * width + Math.min(width - 1, x + 1)];
      const up = heightField[Math.max(0, y - 1) * width + x], down = heightField[Math.min(height - 1, y + 1) * width + x];
      const value = -(right - left) * 0.7 - (down - up) * 0.7;
      shade[y * width + x] = value;
      sum += value;
    }
  }
  const mean = sum / shade.length;
  let variance = 0;
  for (const value of shade) variance += (value - mean) ** 2;
  const scale = 5.6 / Math.sqrt(variance / shade.length);
  const pixels = Buffer.alloc(width * height);
  for (let i = 0; i < shade.length; i++) {
    pixels[i] = Math.round(Math.max(200, Math.min(255, 235 + (shade[i] - mean) * scale)));
  }
  // Bake the brightness(0.65) contrast(4.4) filter and multiply darkening
  // into a black alpha mask so cards composite creases without live filters.
  const blurred = await sharp(pixels, { raw: { width, height, channels: 1 } }).blur(0.6).raw().toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < blurred.length; i++) {
    const v1 = (blurred[i] / 255) * 0.65;
    const v2 = Math.max(0, Math.min(1, (v1 - 0.5) * 4.4 + 0.5));
    rgba[i * 4 + 3] = Math.round((1 - v2) * 255);
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ quality: 75, alphaQuality: 60, effort: 6 });
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let bytes = 0;
for (let variant = 0; variant < CRUMPLE_VARIANTS; variant++) {
  const { size } = await (await crumple(0x5eed + variant * 7919)).toFile(new URL(`crumple-${variant}.webp`, output).pathname);
  bytes += size;
}
console.log(`Generated ${(await readdir(output)).length} paper crumple sheets (${(bytes / 1024).toFixed(1)} KiB).`);
