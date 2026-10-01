import { readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshBVH } from "three-mesh-bvh";
import { createSignedDistanceField } from "../src/grass-field.js";
import { collisionFieldFormat } from "../src/collision-field.js";

const MODEL_HEIGHT = 1.94;
const MODEL_CENTER_Y = 0;
const modelUrl = new URL("../models/emblem/lion_emblem.optimized.glb", import.meta.url);
const outputUrl = new URL("../models/emblem/emblem-collision-field.bin", import.meta.url);

function createCollisionGeometry(model) {
  model.updateWorldMatrix(true, true);
  const geometries = [];

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) return;
    const sourcePositions = object.geometry.attributes.position;
    const positionValues = new Float32Array(sourcePositions.count * 3);
    for (let index = 0; index < sourcePositions.count; index += 1) {
      positionValues[index * 3] = sourcePositions.getX(index);
      positionValues[index * 3 + 1] = sourcePositions.getY(index);
      positionValues[index * 3 + 2] = sourcePositions.getZ(index);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positionValues, 3));
    if (object.geometry.index) geometry.setIndex(object.geometry.index.clone());
    geometry.applyMatrix4(object.matrixWorld);
    geometries.push(geometry);
  });

  if (geometries.length === 0) throw new Error("The lion model has no collision geometry.");
  const collisionGeometry = geometries.length === 1
    ? geometries[0]
    : mergeGeometries(geometries, false);
  if (!collisionGeometry) throw new Error("The lion collision meshes could not be merged.");
  collisionGeometry.computeBoundingBox();
  collisionGeometry.computeBoundingSphere();

  const bvh = new MeshBVH(collisionGeometry, { targetLeafSize: 18 });
  const components = geometries.length === 1
    ? [{ geometry: collisionGeometry, bvh, bounds: collisionGeometry.boundingBox.clone() }]
    : geometries.map((geometry) => {
      geometry.computeBoundingBox();
      return {
        geometry,
        bvh: new MeshBVH(geometry, { targetLeafSize: 18 }),
        bounds: geometry.boundingBox.clone(),
      };
    });
  return { geometry: collisionGeometry, bvh, components };
}

function serializeCollisionField(field, floorSafetyRadius, colliderRadius) {
  const valueCount = field.values.length;
  const normalCount = field.unionNormals.length;
  let maximumAbsoluteDistance = 0;
  field.values.forEach((value) => {
    maximumAbsoluteDistance = Math.max(maximumAbsoluteDistance, Math.abs(value));
  });
  const distanceScale = Math.max(1e-8, maximumAbsoluteDistance / 32767);
  const output = new ArrayBuffer(
    collisionFieldFormat.headerBytes
      + valueCount * Int16Array.BYTES_PER_ELEMENT
      + normalCount,
  );
  const view = new DataView(output);
  view.setUint32(0, collisionFieldFormat.magic, true);
  view.setUint32(4, collisionFieldFormat.version, true);
  field.dimensions.forEach((dimension, index) => {
    view.setUint32(8 + index * 4, dimension, true);
  });
  [
    field.bounds.min.x,
    field.bounds.min.y,
    field.bounds.min.z,
    field.bounds.max.x,
    field.bounds.max.y,
    field.bounds.max.z,
  ].forEach((value, index) => view.setFloat32(20 + index * 4, value, true));
  [field.step.x, field.step.y, field.step.z].forEach((value, index) => {
    view.setFloat32(44 + index * 4, value, true);
  });
  view.setFloat32(56, floorSafetyRadius, true);
  view.setFloat32(60, colliderRadius, true);
  view.setUint32(64, valueCount, true);
  view.setUint32(68, normalCount, true);
  view.setFloat32(72, distanceScale, true);

  const packedDistances = new Int16Array(
    output,
    collisionFieldFormat.headerBytes,
    valueCount,
  );
  field.values.forEach((value, index) => {
    packedDistances[index] = Math.round(value / distanceScale);
  });
  const packedNormals = new Int8Array(
    output,
    collisionFieldFormat.headerBytes + valueCount * Int16Array.BYTES_PER_ELEMENT,
    normalCount,
  );
  field.unionNormals.forEach((value, index) => {
    packedNormals[index] = Math.round(THREE.MathUtils.clamp(value, -1, 1) * 127);
  });
  return output;
}

const modelBuffer = await readFile(modelUrl);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.parseAsync(
  modelBuffer.buffer.slice(modelBuffer.byteOffset, modelBuffer.byteOffset + modelBuffer.byteLength),
  "",
);
const model = gltf.scene;
const modelBounds = new THREE.Box3().setFromObject(model);
const size = modelBounds.getSize(new THREE.Vector3());
const center = modelBounds.getCenter(new THREE.Vector3());
const scale = MODEL_HEIGHT / Math.max(size.y, 0.001);
model.scale.setScalar(scale);
model.position.set(
  -center.x * scale,
  -center.y * scale + MODEL_CENTER_Y,
  -center.z * scale,
);

const startedAt = performance.now();
const collider = createCollisionGeometry(model);
const collisionPositions = collider.geometry.getAttribute("position");
const collisionVertex = new THREE.Vector3();
let floorSafetyRadius = 0;
for (let index = 0; index < collisionPositions.count; index += 1) {
  collisionVertex.fromBufferAttribute(collisionPositions, index);
  floorSafetyRadius = Math.max(floorSafetyRadius, collisionVertex.length());
}
const field = createSignedDistanceField(collider);
const output = serializeCollisionField(
  field,
  floorSafetyRadius,
  collider.geometry.boundingSphere.radius,
);
await writeFile(outputUrl, new Uint8Array(output));

console.log(
  `Generated ${field.dimensions.join("×")} emblem collision field (${(output.byteLength / 1024).toFixed(1)} KiB) in ${(performance.now() - startedAt).toFixed(0)} ms.`,
);
