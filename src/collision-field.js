import * as THREE from "three";

const COLLISION_FIELD_MAGIC = 0x31464453;
const COLLISION_FIELD_VERSION = 2;
const COLLISION_FIELD_HEADER_BYTES = 76;

function createSampler({ bounds, dimensions, step, values, distanceScale, unionNormals }) {
  const gradientSample = new THREE.Vector3();

  function valueIndex(x, y, z) {
    return x + dimensions[0] * (y + dimensions[1] * z);
  }

  function sampleDistance(samplePoint) {
    if (!bounds.containsPoint(samplePoint)) return Infinity;

    const gridX = (samplePoint.x - bounds.min.x) / step.x;
    const gridY = (samplePoint.y - bounds.min.y) / step.y;
    const gridZ = (samplePoint.z - bounds.min.z) / step.z;
    const x0 = Math.min(dimensions[0] - 2, Math.max(0, Math.floor(gridX)));
    const y0 = Math.min(dimensions[1] - 2, Math.max(0, Math.floor(gridY)));
    const z0 = Math.min(dimensions[2] - 2, Math.max(0, Math.floor(gridZ)));
    const tx = THREE.MathUtils.clamp(gridX - x0, 0, 1);
    const ty = THREE.MathUtils.clamp(gridY - y0, 0, 1);
    const tz = THREE.MathUtils.clamp(gridZ - z0, 0, 1);
    const distanceAt = (x, y, z) => values[valueIndex(x, y, z)] * distanceScale;
    const c000 = distanceAt(x0, y0, z0);
    const c100 = distanceAt(x0 + 1, y0, z0);
    const c010 = distanceAt(x0, y0 + 1, z0);
    const c110 = distanceAt(x0 + 1, y0 + 1, z0);
    const c001 = distanceAt(x0, y0, z0 + 1);
    const c101 = distanceAt(x0 + 1, y0, z0 + 1);
    const c011 = distanceAt(x0, y0 + 1, z0 + 1);
    const c111 = distanceAt(x0 + 1, y0 + 1, z0 + 1);
    const x00 = THREE.MathUtils.lerp(c000, c100, tx);
    const x10 = THREE.MathUtils.lerp(c010, c110, tx);
    const x01 = THREE.MathUtils.lerp(c001, c101, tx);
    const x11 = THREE.MathUtils.lerp(c011, c111, tx);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(x00, x10, ty),
      THREE.MathUtils.lerp(x01, x11, ty),
      tz,
    );
  }

  function sampleGradient(samplePoint, target) {
    gradientSample.copy(samplePoint);
    gradientSample.x += step.x;
    const positiveX = sampleDistance(gradientSample);
    gradientSample.x -= step.x * 2;
    const negativeX = sampleDistance(gradientSample);
    gradientSample.copy(samplePoint);
    gradientSample.y += step.y;
    const positiveY = sampleDistance(gradientSample);
    gradientSample.y -= step.y * 2;
    const negativeY = sampleDistance(gradientSample);
    gradientSample.copy(samplePoint);
    gradientSample.z += step.z;
    const positiveZ = sampleDistance(gradientSample);
    gradientSample.z -= step.z * 2;
    const negativeZ = sampleDistance(gradientSample);
    target.set(
      (positiveX - negativeX) / (step.x * 2),
      (positiveY - negativeY) / (step.y * 2),
      (positiveZ - negativeZ) / (step.z * 2),
    );
    if (!Number.isFinite(target.lengthSq()) || target.lengthSq() < 1e-8) {
      target.set(0, 1, 0);
    } else {
      target.normalize();
    }
    return target;
  }

  function sampleUnionNormal(samplePoint, target) {
    if (!bounds.containsPoint(samplePoint)) return target.set(0, 1, 0);

    const gridX = (samplePoint.x - bounds.min.x) / step.x;
    const gridY = (samplePoint.y - bounds.min.y) / step.y;
    const gridZ = (samplePoint.z - bounds.min.z) / step.z;
    const x0 = Math.min(dimensions[0] - 2, Math.max(0, Math.floor(gridX)));
    const y0 = Math.min(dimensions[1] - 2, Math.max(0, Math.floor(gridY)));
    const z0 = Math.min(dimensions[2] - 2, Math.max(0, Math.floor(gridZ)));
    const tx = THREE.MathUtils.clamp(gridX - x0, 0, 1);
    const ty = THREE.MathUtils.clamp(gridY - y0, 0, 1);
    const tz = THREE.MathUtils.clamp(gridZ - z0, 0, 1);

    function interpolateComponent(component) {
      const componentAt = (x, y, z) => (
        unionNormals[valueIndex(x, y, z) * 3 + component] / 127
      );
      const c000 = componentAt(x0, y0, z0);
      const c100 = componentAt(x0 + 1, y0, z0);
      const c010 = componentAt(x0, y0 + 1, z0);
      const c110 = componentAt(x0 + 1, y0 + 1, z0);
      const c001 = componentAt(x0, y0, z0 + 1);
      const c101 = componentAt(x0 + 1, y0, z0 + 1);
      const c011 = componentAt(x0, y0 + 1, z0 + 1);
      const c111 = componentAt(x0 + 1, y0 + 1, z0 + 1);
      const x00 = THREE.MathUtils.lerp(c000, c100, tx);
      const x10 = THREE.MathUtils.lerp(c010, c110, tx);
      const x01 = THREE.MathUtils.lerp(c001, c101, tx);
      const x11 = THREE.MathUtils.lerp(c011, c111, tx);
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(x00, x10, ty),
        THREE.MathUtils.lerp(x01, x11, ty),
        tz,
      );
    }

    target.set(
      interpolateComponent(0),
      interpolateComponent(1),
      interpolateComponent(2),
    );
    if (target.lengthSq() < 1e-8) return sampleGradient(samplePoint, target);
    return target.normalize();
  }

  return { bounds, dimensions, step, sampleDistance, sampleGradient, sampleUnionNormal };
}

export function parseCollisionField(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < COLLISION_FIELD_HEADER_BYTES) {
    throw new Error("The emblem collision field is truncated.");
  }
  if (view.getUint32(0, true) !== COLLISION_FIELD_MAGIC) {
    throw new Error("The emblem collision field has an invalid signature.");
  }
  if (view.getUint32(4, true) !== COLLISION_FIELD_VERSION) {
    throw new Error("The emblem collision field uses an unsupported version.");
  }

  const dimensions = [
    view.getUint32(8, true),
    view.getUint32(12, true),
    view.getUint32(16, true),
  ];
  const bounds = new THREE.Box3(
    new THREE.Vector3(
      view.getFloat32(20, true),
      view.getFloat32(24, true),
      view.getFloat32(28, true),
    ),
    new THREE.Vector3(
      view.getFloat32(32, true),
      view.getFloat32(36, true),
      view.getFloat32(40, true),
    ),
  );
  const step = new THREE.Vector3(
    view.getFloat32(44, true),
    view.getFloat32(48, true),
    view.getFloat32(52, true),
  );
  const floorSafetyRadius = view.getFloat32(56, true);
  const colliderRadius = view.getFloat32(60, true);
  const valueCount = view.getUint32(64, true);
  const normalCount = view.getUint32(68, true);
  const distanceScale = view.getFloat32(72, true);
  const expectedValueCount = dimensions[0] * dimensions[1] * dimensions[2];
  if (
    valueCount !== expectedValueCount
    || normalCount !== valueCount * 3
    || !Number.isFinite(distanceScale)
    || distanceScale <= 0
  ) {
    throw new Error("The emblem collision field dimensions are inconsistent.");
  }

  const valuesEnd = COLLISION_FIELD_HEADER_BYTES + valueCount * Int16Array.BYTES_PER_ELEMENT;
  if (valuesEnd + normalCount > arrayBuffer.byteLength) {
    throw new Error("The emblem collision field data is incomplete.");
  }
  const values = new Int16Array(arrayBuffer, COLLISION_FIELD_HEADER_BYTES, valueCount);
  const unionNormals = new Int8Array(arrayBuffer, valuesEnd, normalCount);
  return {
    ...createSampler({ bounds, dimensions, step, values, distanceScale, unionNormals }),
    floorSafetyRadius,
    colliderRadius,
  };
}

export const collisionFieldFormat = {
  magic: COLLISION_FIELD_MAGIC,
  version: COLLISION_FIELD_VERSION,
  headerBytes: COLLISION_FIELD_HEADER_BYTES,
};
