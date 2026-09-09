import * as THREE from "three";

// Deterministic Permutation Table for 2D Perlin Noise
const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36,
  103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75,
  0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
  56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27,
  166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92,
  41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164,
  100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147,
  118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28,
  42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101,
  155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
  168, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
  191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31,
  181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
  138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66,
  215, 61, 156, 180
];

const P = new Uint8Array(512);
for (let i = 0; i < 256; i++) {
  P[i] = PERMUTATION[i];
  P[256 + i] = PERMUTATION[i];
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad2D(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * Mathematically 100% seamless, periodic 2D Perlin noise.
 */
export function periodicPerlin2D(x, y, periodX = 4, periodY = 4) {
  const pX = Math.max(1, Math.round(periodX));
  const pY = Math.max(1, Math.round(periodY));
  const X0 = ((Math.floor(x) % pX) + pX) % pX;
  const Y0 = ((Math.floor(y) % pY) + pY) % pY;
  const X1 = (X0 + 1) % pX;
  const Y1 = (Y0 + 1) % pY;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = P[P[X0] + Y0];
  const ab = P[P[X0] + Y1];
  const ba = P[P[X1] + Y0];
  const bb = P[P[X1] + Y1];

  return lerp(
    v,
    lerp(u, grad2D(aa, xf, yf), grad2D(ba, xf - 1, yf)),
    lerp(u, grad2D(ab, xf, yf - 1), grad2D(bb, xf - 1, yf - 1))
  );
}

export function periodicFbm(x, y, period = 4, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  const basePeriod = Math.max(1, Math.round(period));
  for (let i = 0; i < octaves; i++) {
    sum += amp * periodicPerlin2D(x * freq, y * freq, basePeriod * freq, basePeriod * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return sum;
}

function createRNG(seed = 88990) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Unified procedural feature simulation:
 * Preserves the exact rich dirt, cabinet toning, and organic patina from the original vintage coin look,
 * with sparse contact divots, hairline scratches, and micro-pores.
 */
let cachedFeatureData = null;

function getRelicFeatureData(size = 512) {
  if (cachedFeatureData && cachedFeatureData.size === size) {
    return cachedFeatureData;
  }

  const rng = createRNG(45678);
  const heightMap = new Float32Array(size * size);
  const pitMask = new Float32Array(size * size);
  const burrMask = new Float32Array(size * size);
  const tarnishMask = new Float32Array(size * size);
  const soilMask = new Float32Array(size * size);

  const period = 4;
  const wrap = (val) => ((Math.floor(val) % size) + size) % size;

  // 1. Hand-hammered flan undulation & continuous organic tarnish
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const idx = y * size + x;

      // Authentic hand-hammered flan rolling waviness & soft die flow
      const flanWaviness = periodicFbm(u, v, period, 2) * 0.08;
      const dieFlow = periodicFbm(u * 2, v * 2, period * 2, 2) * 0.035;
      const microTooth = periodicFbm(u * 12, v * 12, period * 12, 2) * 0.12;

      heightMap[idx] = flanWaviness + dieFlow + microTooth;

      // Rich organic dirt & tarnish variation from the original look
      const macroTarnish = periodicFbm(u, v, period, 3) * 0.48;
      const microPatina = periodicFbm(u * 4, v * 4, period * 4, 3) * 0.22;
      const granularTooth = periodicPerlin2D(u * 16, v * 16, period * 16, period * 16) * 0.10;
      const crystalSpeckle = periodicPerlin2D(u * 32, v * 32, period * 32, period * 32) * 0.06;

      let tarnish = macroTarnish + 0.50 + microPatina + granularTooth + crystalSpeckle;

      // Continuous periodic dark oxidation micro-pores
      const poreNoise = periodicPerlin2D(u * 32, v * 32, period * 32, period * 32);
      if (poreNoise > 0.58) {
        const poreDepth = (poreNoise - 0.58) * 0.85;
        tarnish += poreDepth;
        heightMap[idx] -= poreDepth * 0.15;
        pitMask[idx] = Math.max(pitMask[idx], poreDepth * 0.70);
      }

      tarnishMask[idx] = Math.min(1.0, Math.max(0.0, tarnish));

      // Thin rubbed-on residue: translucent, broken smears beneath loose grains.
      const residue = periodicFbm(u * 2 + 1.37, v * 2 + 0.83, 8, 3);
      const dust = periodicFbm(u * 12 + 2.1, v * 12 + 0.7, 48, 2);
      soilMask[idx] = Math.max(0, Math.min(0.65, 0.20 + residue * 1.05 + dust * 0.48));

    }
  }

  // Fine irregular grains gather more densely in the rubbed residue.
  // Vary their opacity and size instead of stamping identical black dots.
  const soilRng = createRNG(9371);
  for (let grain = 0; grain < 18000; grain++) {
    const cx = soilRng() * size;
    const cy = soilRng() * size;
    if (soilRng() > 0.30 + soilMask[wrap(cy) * size + wrap(cx)] * 1.8) continue;
    const radius = 0.40 + soilRng() * 0.95;
    const opacity = 0.30 + soilRng() * 0.55;
    const stretch = 0.65 + soilRng() * 0.7;
    const reach = Math.ceil(radius * 1.6);
    for (let y = Math.floor(cy) - reach; y <= Math.ceil(cy) + reach; y++) {
      for (let x = Math.floor(cx) - reach; x <= Math.ceil(cx) + reach; x++) {
        const distance = Math.hypot((x + 0.5 - cx) * stretch, (y + 0.5 - cy) / stretch);
        const edge = Math.max(0, Math.min(1, (radius - distance) / 0.45));
        const idx = wrap(y) * size + wrap(x);
        const grainAlpha = opacity * edge * edge * (3 - 2 * edge);
        soilMask[idx] = Math.min(0.90, soilMask[idx] + grainAlpha * (1 - soilMask[idx]));
      }
    }
  }

  // 2. Scattered contact divots and bag nicks, leaving most metal unmarked.
  const divotCount = 420;
  for (let d = 0; d < divotCount; d++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const radius = 0.55 + Math.pow(rng(), 2) * 1.65;
    const depth = 0.10 + rng() * 0.20;
    const iRad = Math.ceil(radius + 1.2);

    for (let dy = -iRad; dy <= iRad; dy++) {
      for (let dx = -iRad; dx <= iRad; dx++) {
        const dist = Math.hypot(dx * 0.85, dy * 1.15);
        if (dist <= radius) {
          const px = wrap(cx + dx);
          const py = wrap(cy + dy);
          const idx = py * size + px;
          const falloff = 1.0 - (dist / radius) * (dist / radius);
          const delta = falloff * depth;
          heightMap[idx] -= delta;
          pitMask[idx] = Math.max(pitMask[idx], falloff * 0.48);
          tarnishMask[idx] = Math.min(1.0, tarnishMask[idx] + falloff * 0.28);
        }
      }
    }
    // Tiny displaced metal burr on one edge
    const bx = wrap(cx + 1);
    const by = wrap(cy + 1);
    heightMap[by * size + bx] += depth * 0.28;
    burrMask[by * size + bx] = Math.max(burrMask[by * size + bx], 0.60);
  }

  // 3. Sparse crescent bag marks from circulation.
  const crescentCount = 16;
  for (let c = 0; c < crescentCount; c++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const radius = 3.0 + rng() * 6.0;
    const startAngle = rng() * Math.PI * 2;
    const arcSpan = 0.4 + rng() * 0.8;
    const depth = 0.14 + rng() * 0.18;
    const steps = Math.max(4, Math.ceil(radius * arcSpan * 2));

    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const angle = startAngle + t * arcSpan;
      const px = wrap(cx + Math.cos(angle) * radius);
      const py = wrap(cy + Math.sin(angle) * radius);
      const profile = Math.sin(t * Math.PI) * depth;
      const idx = py * size + px;

      heightMap[idx] -= profile;
      pitMask[idx] = Math.max(pitMask[idx], Math.sin(t * Math.PI) * 0.75);
      tarnishMask[idx] = Math.min(1.0, tarnishMask[idx] + profile * 0.9);

      const ox = wrap(cx + Math.cos(angle) * (radius + 1.0));
      const oy = wrap(cy + Math.sin(angle) * (radius + 1.0));
      heightMap[oy * size + ox] += profile * 0.24;
      burrMask[oy * size + ox] = Math.max(burrMask[oy * size + ox], 0.50);
    }
  }

  // 4. Fine hairline circulation scratches.
  const scratchCount = 24;
  for (let s = 0; s < scratchCount; s++) {
    let x = rng() * size;
    let y = rng() * size;
    let angle = rng() * Math.PI * 2;
    const curvature = (rng() - 0.5) * 0.04;
    const length = 3 + rng() * 8;
    const depth = 0.10 + rng() * 0.14;
    const steps = Math.ceil(length * 1.4);

    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      angle += curvature;
      x = (x + Math.cos(angle) * 0.60 + size * 10) % size;
      y = (y + Math.sin(angle) * 0.60 + size * 10) % size;

      const px = wrap(x);
      const py = wrap(y);
      const idx = py * size + px;
      const profile = Math.sin(t * Math.PI) * depth;

      heightMap[idx] -= profile;
      pitMask[idx] = Math.max(pitMask[idx], profile * 0.65);
      tarnishMask[idx] = Math.min(1.0, tarnishMask[idx] + profile * 0.8);

      const burrAngle = angle + Math.PI * 0.5;
      const bx = wrap(x + Math.cos(burrAngle));
      const by = wrap(y + Math.sin(burrAngle));
      heightMap[by * size + bx] += profile * 0.20;
      burrMask[by * size + bx] = Math.max(burrMask[by * size + bx], 0.40);
    }
  }

  // Soil rests above the metal. Its positive relief catches light rather than
  // sharing the recessed normal profile of corrosion pits.
  for (let i = 0; i < heightMap.length; i++) heightMap[i] += soilMask[i] * 0.18;

  cachedFeatureData = { size, heightMap, pitMask, burrMask, tarnishMask, soilMask };
  return cachedFeatureData;
}

/**
 * Generates an Antique Circulated Coin Normal Map:
 * - Continuous toroidal boundary with zero seams
 * - Hand-hammered flan undulation and gentle die flow
 * - Tactile micro-pores and sparse tiny contact marks
 */
export function createRelicNormalMap(size = 512, strength = 1.25) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const featureData = getRelicFeatureData(size);
  const heightData = featureData.heightMap;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xL = (x - 1 + size) % size;
      const xR = (x + 1) % size;
      const yU = (y - 1 + size) % size;
      const yD = (y + 1) % size;

      const xL2 = (x - 2 + size) % size;
      const xR2 = (x + 2) % size;
      const yU2 = (y - 2 + size) % size;
      const yD2 = (y + 2) % size;

      const dX = (
        (heightData[y * size + xR] - heightData[y * size + xL]) * 2.0 +
        (heightData[yU * size + xR] - heightData[yU * size + xL]) * 1.0 +
        (heightData[yD * size + xR] - heightData[yD * size + xL]) * 1.0 +
        (heightData[y * size + xR2] - heightData[y * size + xL2]) * 0.5
      ) * strength * 0.38;

      const dY = (
        (heightData[yD * size + x] - heightData[yU * size + x]) * 2.0 +
        (heightData[yD * size + xR] - heightData[yU * size + xR]) * 1.0 +
        (heightData[yD * size + xL] - heightData[yU * size + xL]) * 1.0 +
        (heightData[yD2 * size + x] - heightData[yU2 * size + x]) * 0.5
      ) * strength * 0.38;

      const len = Math.hypot(-dX, -dY, 1.0);
      const nx = -dX / len;
      const ny = -dY / len;
      const nz = 1.0 / len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates an Antique Circulated Coin Roughness Map:
 * - Satin metal with rougher oxidation and pits
 * - R: pit mask, G: roughness, B: tarnish mask, A: residual soil
 * - Rough, granular oxidation inside recesses
 */
export function createRelicRoughnessMap(size = 512) {
  const featureData = getRelicFeatureData(size);
  const { pitMask, burrMask, tarnishMask, soilMask } = featureData;

  // Raw channel data avoids canvas premultiplication corrupting RGB when soil is zero.
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    let r = 0.34 + tarnishMask[i] * 0.22;
    if (pitMask[i] > 0.05) {
      r = Math.min(0.65, r + pitMask[i] * 0.20);
    }
    if (burrMask[i] > 0.05) {
      r = Math.max(0.25, r - burrMask[i] * 0.10);
    }

    const val = Math.round(Math.min(255, Math.max(0, r * 255)));
    const idx = i * 4;
    data[idx] = Math.round(pitMask[i] * 255);
    data[idx + 1] = val;
    data[idx + 2] = Math.round(tarnishMask[i] * 255);
    data[idx + 3] = Math.round(soilMask[i] * 255);
  }

  const texture = new THREE.DataTexture(data, size, size);
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates an authentic Antique Circulated Coin Albedo Map:
 * - Mottled cabinet toning and organic patina
 * - Settled charcoal/gunmetal patina in fields and micro-recesses
 * - Warm terracotta/umber blush in transitional oxidation zones
 * - Sparse tiny contact marks and micro-hairlines
 */
export function createRelicAlbedoMap(baseHexColor, size = 512, patinaStrength = 0.58) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const featureData = getRelicFeatureData(size);
  const { pitMask, burrMask, tarnishMask } = featureData;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const base = new THREE.Color(baseHexColor);
  const r0 = base.r * 235;
  const g0 = base.g * 235;
  const b0 = base.b * 235;

  // Dark inky charcoal / deep gunmetal cabinet tarnish
  const tarnishR = 22, tarnishG = 18, tarnishB = 15;
  // Warm antique bronze / terracotta blush in transitional oxidation zones
  const blushR = 56, blushG = 40, blushB = 28;

  for (let i = 0; i < size * size; i++) {
    let tarnish = Math.min(0.85, Math.max(0.0, tarnishMask[i] * patinaStrength));
    const pit = pitMask[i];
    const burr = burrMask[i];

    if (pit > 0.05) {
      tarnish = Math.min(0.92, tarnish + pit * 0.35);
    }

    let r = r0 * (1.0 - tarnish) + tarnishR * tarnish;
    let g = g0 * (1.0 - tarnish) + tarnishG * tarnish;
    let b = b0 * (1.0 - tarnish) + tarnishB * tarnish;

    // Soft antique bronze / umber blush in moderate patina zones
    if (tarnish > 0.32) {
      const bWeight = Math.min(0.48, (tarnish - 0.32) * 0.65);
      r = r * (1.0 - bWeight) + blushR * bWeight;
      g = g * (1.0 - bWeight) + blushG * bWeight;
      b = b * (1.0 - bWeight) + blushB * bWeight;
    }

    // Subtle metallic glints on raised burrs
    if (burr > 0.12) {
      const burrW = burr * 0.14;
      r = Math.min(255, r * (1.0 + burrW) + r0 * 0.08);
      g = Math.min(255, g * (1.0 + burrW) + g0 * 0.08);
      b = Math.min(255, b * (1.0 + burrW) + b0 * 0.08);
    }

    const idx = i * 4;
    data[idx] = Math.round(Math.min(255, Math.max(0, r)));
    data[idx + 1] = Math.round(Math.min(255, Math.max(0, g)));
    data[idx + 2] = Math.round(Math.min(255, Math.max(0, b)));
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates soft, dull antique museum lighting HDR environment.
 */
export function createStudioEnvironment(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#8a867c");
  grad.addColorStop(0.35, "#54514a");
  grad.addColorStop(0.7, "#22272b");
  grad.addColorStop(1.0, "#0a0d0e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft antique left softbox
  const leftSoftbox = ctx.createLinearGradient(60, 0, 220, 0);
  leftSoftbox.addColorStop(0, "rgba(255, 235, 205, 0)");
  leftSoftbox.addColorStop(0.25, "rgba(255, 235, 205, 0.50)");
  leftSoftbox.addColorStop(0.5, "rgba(255, 245, 225, 0.75)");
  leftSoftbox.addColorStop(0.75, "rgba(255, 235, 205, 0.50)");
  leftSoftbox.addColorStop(1, "rgba(255, 235, 205, 0)");
  ctx.fillStyle = leftSoftbox;
  ctx.fillRect(60, 15, 160, 190);

  // Balanced right softbox
  const rightSoftbox = ctx.createLinearGradient(300, 0, 460, 0);
  rightSoftbox.addColorStop(0, "rgba(255, 235, 205, 0)");
  rightSoftbox.addColorStop(0.25, "rgba(255, 235, 205, 0.50)");
  rightSoftbox.addColorStop(0.5, "rgba(255, 245, 225, 0.75)");
  rightSoftbox.addColorStop(0.75, "rgba(255, 235, 205, 0.50)");
  rightSoftbox.addColorStop(1, "rgba(255, 235, 205, 0)");
  ctx.fillStyle = rightSoftbox;
  ctx.fillRect(300, 15, 160, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;

  pmremGenerator.dispose();
  texture.dispose();

  return envMap;
}

/**
 * Injects Antique Circulated Coin Shader Logic:
 * - Shared feature masks align dirt, roughness, and pitting.
 * - Uniformly applies patina, metallic depth, and sparse imperfections across all faces and sides
 * - Oblique projection distributes wear across faces, side walls, and bevels.
 */
export function applyTriplanarShader(material, textures, albedoTexture, scale = 0.65) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };
    shader.uniforms.uRelicAlbedo = { value: albedoTexture };
    shader.uniforms.uRelicNormal = { value: textures.relicNormal };
    shader.uniforms.uRelicRoughness = { value: textures.relicRoughness };
    shader.uniforms.uNormalStrength = { value: 0.65 };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vTriPos;
      varying vec3 vTriNorm;
      varying mat3 vNormalMat;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vTriPos = position;
      vTriNorm = normal;
      vNormalMat = normalMatrix;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vTriPos;
      varying vec3 vTriNorm;
      varying mat3 vNormalMat;
      uniform float uTriScale;
      uniform sampler2D uRelicAlbedo;
      uniform sampler2D uRelicNormal;
      uniform sampler2D uRelicRoughness;
      uniform float uNormalStrength;

      // 3D Oblique rotation & prime offset to completely eliminate mirror symmetry
      const mat3 cAsymRot = mat3(
         0.7984,  0.4221, -0.4302,
        -0.3771,  0.8980,  0.2265,
         0.4703, -0.0182,  0.8823
      );
      const vec3 cAsymOffset = vec3(4.193, 2.731, 5.847);

      vec3 computeTriplanarBlend(vec3 norm) {
        vec3 blending = pow(abs(norm), vec3(4.0));
        return blending / (blending.x + blending.y + blending.z);
      }`
    );

    // Diffuse & Outline Cabinet Toning:
    // Restores the rich dirt in the inner raised outlines while allowing the side perimeter walls to be rich antique metal
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 pAsym = cAsymRot * vTriPos + cAsymOffset;
      vec3 projectionNormal = normalize(cAsymRot * vTriNorm);
      vec3 triBlend = computeTriplanarBlend(projectionNormal);

      vec2 uvX = pAsym.zy * uTriScale;
      vec2 uvY = pAsym.xz * uTriScale;
      vec2 uvZ = pAsym.xy * uTriScale;

      vec4 triColor = texture2D(uRelicAlbedo, uvX) * triBlend.x
                    + texture2D(uRelicAlbedo, uvY) * triBlend.y
                    + texture2D(uRelicAlbedo, uvZ) * triBlend.z;

      vec4 triRoughness = texture2D(uRelicRoughness, uvX) * triBlend.x
                        + texture2D(uRelicRoughness, uvY) * triBlend.y
                        + texture2D(uRelicRoughness, uvZ) * triBlend.z;

      // A translucent dust film and small raised grains cover every orientation.
      // Keep soil separate from the pit mask: dark recesses are not soil particles.
      float soilCoverage = clamp(triRoughness.a * 1.15, 0.0, 0.90);
      vec3 soilColor = mix(vec3(0.0008), vec3(0.003), triRoughness.b);

      // Inner outline crevice dirt for the raised face beads and petal joints
      float innerOutlineSlope = (1.0 - smoothstep(0.42, 0.92, abs(vTriNorm.z)));
      // Protect outer perimeter side walls from turning pitch black
      float sideMask = smoothstep(0.22, 0.48, abs(vTriNorm.z));
      float creviceDirt = clamp(innerOutlineSlope * sideMask * 0.52 + smoothstep(0.55, 0.90, triRoughness.b) * 0.24 + triRoughness.r * 0.32, 0.0, 1.0);
      vec3 darkCabinetBlack = vec3(0.04, 0.035, 0.028);

      // High-relief contact wear (smooth, slightly burnished high points like cheek crest and rim tops)
      float highReliefBurnish = smoothstep(0.70, 0.96, abs(vTriNorm.z)) * (1.0 - creviceDirt);
      vec3 burnishedColor = triColor.rgb * 1.06 + vec3(0.02, 0.016, 0.012);

      vec3 tonedBase = mix(triColor.rgb, burnishedColor, highReliefBurnish * 0.35);
      diffuseColor.rgb = mix(tonedBase, darkCabinetBlack, creviceDirt * 0.58);
      // Slightly deepen the existing soil tint without changing grain placement or relief.
      diffuseColor.rgb = mix(diffuseColor.rgb, soilColor, min(soilCoverage * 1.10, 0.95));`
    );

    // Roughness: Smooth satin high points vs soft crevice shading
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      float innerOutlineSlopeR = (1.0 - smoothstep(0.42, 0.92, abs(vTriNorm.z)));
      float sideMaskR = smoothstep(0.22, 0.48, abs(vTriNorm.z));
      float creviceDirtR = clamp(innerOutlineSlopeR * sideMaskR * 0.32 + triRoughness.r * 0.55 + smoothstep(0.55, 0.90, triRoughness.b) * 0.30, 0.0, 1.0);
      float highReliefR = smoothstep(0.70, 0.96, abs(vTriNorm.z)) * (1.0 - creviceDirtR);

      float satinRoughness = mix(triRoughness.g, 0.34, highReliefR * 0.35);
      roughnessFactor = mix(satinRoughness, 0.65, creviceDirtR * 0.55);
      roughnessFactor = mix(roughnessFactor, 0.86, soilCoverage);`
    );

    // Metalness: Conductive antique metal on crests, gentle decrease in crevices
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <metalnessmap_fragment>",
      `#include <metalnessmap_fragment>
      float innerOutlineSlopeM = (1.0 - smoothstep(0.42, 0.92, abs(vTriNorm.z)));
      float sideMaskM = smoothstep(0.22, 0.48, abs(vTriNorm.z));
      float creviceDirtM = clamp(innerOutlineSlopeM * sideMaskM * 0.32 + triRoughness.r * 0.55 + smoothstep(0.55, 0.90, triRoughness.b) * 0.30, 0.0, 1.0);
      float highReliefM = smoothstep(0.70, 0.96, abs(vTriNorm.z)) * (1.0 - creviceDirtM);

      float metallicConductance = mix(0.85, 0.90, highReliefM * 0.25);
      metalnessFactor = mix(metallicConductance, 0.52, creviceDirtM * 0.42);
      metalnessFactor = mix(metalnessFactor, 0.08, soilCoverage);`
    );

    // Micro-porosity, gouge, and bag mark normal perturbation with correct triplanar projection
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      vec3 tNormX = texture2D(uRelicNormal, uvX).xyz * 2.0 - 1.0;
      vec3 tNormY = texture2D(uRelicNormal, uvY).xyz * 2.0 - 1.0;
      vec3 tNormZ = texture2D(uRelicNormal, uvZ).xyz * 2.0 - 1.0;

      // Blend height gradients in the same rotated frame as the texture coordinates.
      // A neutral map contributes zero, preserving bevels and back-facing normals.
      vec2 slopeX = -tNormX.xy / max(tNormX.z, 0.1);
      vec2 slopeY = -tNormY.xy / max(tNormY.z, 0.1);
      vec2 slopeZ = -tNormZ.xy / max(tNormZ.z, 0.1);
      vec3 gradient = vec3(0.0, slopeX.y, slopeX.x) * triBlend.x
                    + vec3(slopeY.x, 0.0, slopeY.y) * triBlend.y
                    + vec3(slopeZ.x, slopeZ.y, 0.0) * triBlend.z;
      gradient -= projectionNormal * dot(gradient, projectionNormal);
      vec3 objectGradient = transpose(cAsymRot) * gradient;
      vec3 viewGradient = vNormalMat * objectGradient;
      normal = normalize(normal - viewGradient * uNormalStrength * faceDirection);`
    );
  };
}

/**
 * Upgrades a mesh material to MeshPhysicalMaterial with antique circulated coin patina properties.
 */
export function upgradeToPhysicalMaterial(sourceMaterial, textures, style = "ancient-coin") {
  const color = sourceMaterial.color ? sourceMaterial.color.clone() : new THREE.Color(0xd4af37);
  const hexKey = color.getHexString();

  if (textures.albedoCache && !textures.albedoCache[hexKey]) {
    textures.albedoCache[hexKey] = createRelicAlbedoMap(color, 512, 0.56);
  }
  const albedoTexture = textures.albedoCache[hexKey];

  let params = {
    color,
    roughness: 0.35,       // Smooth satin antique patina
    metalness: 0.88,       // Conductive antique metal with patina
    clearcoat: 0.0,        // Zero lacquer
    clearcoatRoughness: 0.8,
    sheen: 0.06,
    sheenRoughness: 0.50,
    sheenColor: new THREE.Color(0xbfa568),
    envMapIntensity: 0.90, // Soft ambient reflection
  };

  if (style === "ancient-coin") {
    params.metalness = 0.88;
    params.roughness = 0.35;
    params.envMapIntensity = 0.90;
  } else if (style === "heavy-patina-coin") {
    params.metalness = 0.76;
    params.roughness = 0.52;
    params.envMapIntensity = 0.70;
  } else if (style === "smooth-metal") {
    params.metalness = 0.95;
    params.roughness = 0.20;
    params.envMapIntensity = 1.30;
    return new THREE.MeshPhysicalMaterial(params);
  }

  const physicalMat = new THREE.MeshPhysicalMaterial(params);
  applyTriplanarShader(physicalMat, textures, albedoTexture, 0.65);
  return physicalMat;
}
