import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import * as THREE from "three";
import { createRelicNormalMap, createRelicRoughnessMap, createRelicAlbedoMap } from "../src/emblem-textures.js";

// These generators only need pixel buffers; no browser or native canvas is needed.
globalThis.document = {
  createElement() {
    const canvas = {};
    canvas.getContext = () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: (image) => { canvas.pixels = image.data; },
    });
    return canvas;
  },
};
const model = await readFile(new URL("../models/emblem/lion_emblem.optimized.glb", import.meta.url));
const jsonLength = model.readUInt32LE(12);
const gltf = JSON.parse(model.subarray(20, 20 + jsonLength).toString());
const colors = new Map();
for (const material of gltf.materials || []) {
  const rgb = material.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1];
  const color = new THREE.Color().setRGB(...rgb.slice(0, 3));
  colors.set(color.getHexString(), color);
}
const textures = {
  normal: createRelicNormalMap(),
  roughness: createRelicRoughnessMap(),
};
for (const [key, color] of colors) textures[key] = createRelicAlbedoMap(color, 512, 0.56);
const output = new URL("../src/assets/emblem-textures/", import.meta.url);
await mkdir(output, { recursive: true });
for (const [name, texture] of Object.entries(textures)) {
  const pixels = Buffer.from(texture.image.pixels || texture.image.data);
  const packed = await sharp(pixels, { raw: { width: 512, height: 512, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100, effort: 6 }).toBuffer();
  await writeFile(new URL(`${name}.webp`, output), packed);
  console.log(`${name}: ${(packed.length / 1024).toFixed(1)} KiB`);
}
