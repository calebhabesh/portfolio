import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const BLADE_COUNT = 9;
const PACKED_BEND_ATTRIBUTE_COUNT = Math.ceil(BLADE_COUNT / 2);
const PROBE_LEVELS = [0.1, 0.3, 0.5, 0.7, 0.9];
const COLLISION_RADIUS = 0.08;
const CONTACT_SEARCH_RADIUS = 0.22;
const CONTACT_SOLVER_ITERATIONS = 3;
const MAX_ROTATION_PER_SUBSTEP = 0.035;
const MAX_TRANSLATION_PER_SUBSTEP = 0.035;
const MAX_TIME_PER_SUBSTEP = 0.02;
const DISTANCE_FIELD_CELL_SIZE = 0.035;
const BEND_EXPONENT = 1;
const MAX_NORMALIZED_BEND = 1;

function seededRandom(seed = 41729) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSignedDistanceField(collider) {
  const bounds = collider.geometry.boundingBox.clone().expandByScalar(CONTACT_SEARCH_RADIUS);
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = [size.x, size.y, size.z].map((axisSize) => (
    Math.max(3, Math.min(72, Math.ceil(axisSize / DISTANCE_FIELD_CELL_SIZE) + 1))
  ));
  const step = new THREE.Vector3(
    size.x / (dimensions[0] - 1),
    size.y / (dimensions[1] - 1),
    size.z / (dimensions[2] - 1),
  );
  const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2]);
  const insideMask = new Uint8Array(values.length);
  const point = new THREE.Vector3();
  const closestHit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };

  function valueIndex(x, y, z) {
    return x + dimensions[0] * (y + dimensions[1] * z);
  }

  const ray = new THREE.Ray(
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, 1),
  );
  for (let y = 0; y < dimensions[1]; y += 1) {
    const sampleY = bounds.min.y + step.y * y;
    for (let x = 0; x < dimensions[0]; x += 1) {
      const sampleX = bounds.min.x + step.x * x;
      ray.origin.set(sampleX, sampleY, bounds.min.z - step.z);

      collider.components.forEach((component) => {
        if (
          sampleX < component.bounds.min.x
          || sampleX > component.bounds.max.x
          || sampleY < component.bounds.min.y
          || sampleY > component.bounds.max.y
        ) return;

        const intersections = component.bvh.raycast(
          ray,
          THREE.DoubleSide,
          0,
          size.z + CONTACT_SEARCH_RADIUS * 2,
        );
        intersections.sort((first, second) => first.distance - second.distance);
        const hitPositions = [];
        intersections.forEach((intersection) => {
          const hitZ = ray.origin.z + intersection.distance;
          const previousHit = hitPositions.at(-1);
          if (previousHit === undefined || Math.abs(hitZ - previousHit) > 1e-4) {
            hitPositions.push(hitZ);
          }
        });
        if (hitPositions.length < 2) return;

        const pairedHitCount = hitPositions.length - (hitPositions.length % 2);
        for (let hitIndex = 0; hitIndex < pairedHitCount; hitIndex += 2) {
          const intervalStart = hitPositions[hitIndex];
          const intervalEnd = hitPositions[hitIndex + 1];
          for (let z = 0; z < dimensions[2]; z += 1) {
            const sampleZ = bounds.min.z + step.z * z;
            if (sampleZ >= intervalStart - 1e-5 && sampleZ <= intervalEnd + 1e-5) {
              insideMask[valueIndex(x, y, z)] = 1;
            }
          }
        }
      });
    }
  }

  const unionNormals = new Float32Array(values.length * 3);
  const unionDepth = new Float32Array(values.length);
  const assignedNormal = new Uint8Array(values.length);
  const normalQueue = new Int32Array(values.length);
  let queueStart = 0;
  let queueEnd = 0;
  const boundaryDepth = Math.min(step.x, step.y, step.z) * 0.5;
  const neighborOffsets = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ];

  for (let z = 0; z < dimensions[2]; z += 1) {
    for (let y = 0; y < dimensions[1]; y += 1) {
      for (let x = 0; x < dimensions[0]; x += 1) {
        const index = valueIndex(x, y, z);
        if (!insideMask[index]) continue;

        let normalX = 0;
        let normalY = 0;
        let normalZ = 0;
        neighborOffsets.forEach(([offsetX, offsetY, offsetZ]) => {
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          const neighborZ = z + offsetZ;
          if (
            neighborX < 0 || neighborX >= dimensions[0]
            || neighborY < 0 || neighborY >= dimensions[1]
            || neighborZ < 0 || neighborZ >= dimensions[2]
            || !insideMask[valueIndex(neighborX, neighborY, neighborZ)]
          ) {
            normalX += offsetX;
            normalY += offsetY;
            normalZ += offsetZ;
          }
        });
        const normalLength = Math.hypot(normalX, normalY, normalZ);
        if (normalLength < 1e-6) continue;

        unionNormals[index * 3] = normalX / normalLength;
        unionNormals[index * 3 + 1] = normalY / normalLength;
        unionNormals[index * 3 + 2] = normalZ / normalLength;
        unionDepth[index] = boundaryDepth;
        assignedNormal[index] = 1;
        normalQueue[queueEnd] = index;
        queueEnd += 1;
      }
    }
  }

  const layerSize = dimensions[0] * dimensions[1];
  while (queueStart < queueEnd) {
    const index = normalQueue[queueStart];
    queueStart += 1;
    const z = Math.floor(index / layerSize);
    const layerIndex = index - z * layerSize;
    const y = Math.floor(layerIndex / dimensions[0]);
    const x = layerIndex - y * dimensions[0];

    neighborOffsets.forEach(([offsetX, offsetY, offsetZ]) => {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      const neighborZ = z + offsetZ;
      if (
        neighborX < 0 || neighborX >= dimensions[0]
        || neighborY < 0 || neighborY >= dimensions[1]
        || neighborZ < 0 || neighborZ >= dimensions[2]
      ) return;
      const neighborIndex = valueIndex(neighborX, neighborY, neighborZ);
      if (!insideMask[neighborIndex] || assignedNormal[neighborIndex]) return;

      unionNormals[neighborIndex * 3] = unionNormals[index * 3];
      unionNormals[neighborIndex * 3 + 1] = unionNormals[index * 3 + 1];
      unionNormals[neighborIndex * 3 + 2] = unionNormals[index * 3 + 2];
      unionDepth[neighborIndex] = unionDepth[index]
        + (offsetX !== 0 ? step.x : offsetY !== 0 ? step.y : step.z);
      assignedNormal[neighborIndex] = 1;
      normalQueue[queueEnd] = neighborIndex;
      queueEnd += 1;
    });
  }

  for (let z = 0; z < dimensions[2]; z += 1) {
    for (let y = 0; y < dimensions[1]; y += 1) {
      for (let x = 0; x < dimensions[0]; x += 1) {
        const index = valueIndex(x, y, z);
        if (insideMask[index]) {
          values[index] = -Math.max(boundaryDepth, unionDepth[index]);
          continue;
        }
        point.set(
          bounds.min.x + step.x * x,
          bounds.min.y + step.y * y,
          bounds.min.z + step.z * z,
        );
        collider.bvh.closestPointToPoint(point, closestHit);
        values[index] = closestHit.distance;
      }
    }
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
    const c000 = values[valueIndex(x0, y0, z0)];
    const c100 = values[valueIndex(x0 + 1, y0, z0)];
    const c010 = values[valueIndex(x0, y0 + 1, z0)];
    const c110 = values[valueIndex(x0 + 1, y0 + 1, z0)];
    const c001 = values[valueIndex(x0, y0, z0 + 1)];
    const c101 = values[valueIndex(x0 + 1, y0, z0 + 1)];
    const c011 = values[valueIndex(x0, y0 + 1, z0 + 1)];
    const c111 = values[valueIndex(x0 + 1, y0 + 1, z0 + 1)];
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

  const gradientSample = new THREE.Vector3();
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
      const c000 = unionNormals[valueIndex(x0, y0, z0) * 3 + component];
      const c100 = unionNormals[valueIndex(x0 + 1, y0, z0) * 3 + component];
      const c010 = unionNormals[valueIndex(x0, y0 + 1, z0) * 3 + component];
      const c110 = unionNormals[valueIndex(x0 + 1, y0 + 1, z0) * 3 + component];
      const c001 = unionNormals[valueIndex(x0, y0, z0 + 1) * 3 + component];
      const c101 = unionNormals[valueIndex(x0 + 1, y0, z0 + 1) * 3 + component];
      const c011 = unionNormals[valueIndex(x0, y0 + 1, z0 + 1) * 3 + component];
      const c111 = unionNormals[valueIndex(x0 + 1, y0 + 1, z0 + 1) * 3 + component];
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

  return {
    bounds,
    dimensions,
    step,
    values,
    unionNormals,
    sampleDistance,
    sampleGradient,
    sampleUnionNormal,
  };
}

function createTuftGeometry() {
  const random = seededRandom(70121);
  const segmentCount = 4;
  const positions = [];
  const normals = [];
  const uvs = [];
  const bladeIndices = [];
  const bladeHeights = [];
  const indices = [];
  const bladeTemplates = [];

  for (let bladeIndex = 0; bladeIndex < BLADE_COUNT; bladeIndex += 1) {
    const angle = (bladeIndex / BLADE_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.7;
    const rightX = Math.cos(angle);
    const rightZ = Math.sin(angle);
    const normalX = -rightZ;
    const normalZ = rightX;
    const leanAngle = angle + (random() - 0.5) * 1.5;
    const leanX = Math.cos(leanAngle);
    const leanZ = Math.sin(leanAngle);
    const rootRadius = 0.015 + random() * 0.105;
    const rootX = Math.cos(angle) * rootRadius;
    const rootZ = Math.sin(angle) * rootRadius;
    const bladeHeight = 0.78 + random() * 0.32;
    // Chunkier stylized blade: ~2.5x wider for screen-space clarity
    const bladeWidth = 0.038 + random() * 0.022;
    const leanAmount = 0.08 + random() * 0.12;
    const vertexOffset = positions.length / 3;
    bladeTemplates.push({
      rootX,
      rootZ,
      height: bladeHeight,
      leanX: leanX * leanAmount,
      leanZ: leanZ * leanAmount,
    });

    for (let segmentIndex = 0; segmentIndex <= segmentCount; segmentIndex += 1) {
      const heightRatio = segmentIndex / segmentCount;
      const curve = heightRatio * heightRatio;
      const centerX = rootX + leanX * leanAmount * curve;
      const centerZ = rootZ + leanZ * leanAmount * curve;
      // Stylized blade profile: sturdy base, wide lush body, and a defined tip that avoids sub-pixel pinching
      const baseFlare = 0.65 + 0.35 * Math.min(1, heightRatio * 3.0);
      const taper = Math.max(0.24, 1.0 - 0.76 * Math.pow(heightRatio, 1.35));
      const halfWidth = bladeWidth * baseFlare * taper * 0.5;
      const y = bladeHeight * heightRatio;

      positions.push(
        centerX - rightX * halfWidth,
        y,
        centerZ - rightZ * halfWidth,
        centerX + rightX * halfWidth,
        y,
        centerZ + rightZ * halfWidth,
      );
      normals.push(normalX, 0.1 * heightRatio, normalZ, normalX, 0.1 * heightRatio, normalZ);
      uvs.push(0, heightRatio, 1, heightRatio);
      bladeIndices.push(bladeIndex, bladeIndex);
      bladeHeights.push(bladeHeight, bladeHeight);
    }

    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const lowerLeft = vertexOffset + segmentIndex * 2;
      const lowerRight = lowerLeft + 1;
      const upperLeft = lowerLeft + 2;
      const upperRight = lowerLeft + 3;
      indices.push(lowerLeft, lowerRight, upperLeft, lowerRight, upperRight, upperLeft);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "grassBladeIndex",
    new THREE.Float32BufferAttribute(bladeIndices, 1),
  );
  geometry.setAttribute(
    "grassBladeHeight",
    new THREE.Float32BufferAttribute(bladeHeights, 1),
  );
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, bladeTemplates };
}

function createGrassMaterial(timeUniform, colorUniforms) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = timeUniform;
    shader.uniforms.uGrassBaseColor = colorUniforms.base;
    shader.uniforms.uGrassTipColor = colorUniforms.tip;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uGrassTime;
        attribute float grassBladeIndex;
        attribute float grassBladeHeight;
        attribute vec4 instanceBend0;
        attribute vec4 instanceBend1;
        attribute vec4 instanceBend2;
        attribute vec4 instanceBend3;
        attribute vec4 instanceBend4;
        attribute float instancePhase;
        varying float vGrassHeight;
        varying float vGrassVariation;
        varying vec2 vGrassUv;

        vec2 getGrassBend(float bladeIndex) {
          if (bladeIndex < 0.5) return instanceBend0.xy;
          if (bladeIndex < 1.5) return instanceBend0.zw;
          if (bladeIndex < 2.5) return instanceBend1.xy;
          if (bladeIndex < 3.5) return instanceBend1.zw;
          if (bladeIndex < 4.5) return instanceBend2.xy;
          if (bladeIndex < 5.5) return instanceBend2.zw;
          if (bladeIndex < 6.5) return instanceBend3.xy;
          if (bladeIndex < 7.5) return instanceBend3.zw;
          return instanceBend4.xy;
        }`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3(position);
        float grassHeight = clamp(uv.y, 0.0, 1.0);
        float bendWeight = pow(grassHeight, 1.2);
        vec2 grassBend = getGrassBend(grassBladeIndex);
        float instanceHeight = length(instanceMatrix[1].xyz);
        float normalizedBend = clamp(
          length(grassBend) / max(0.001, grassBladeHeight * instanceHeight),
          0.0,
          0.96
        );
        float uprightScale = sqrt(max(0.001, 1.0 - normalizedBend * normalizedBend));
        transformed.y *= uprightScale;
        float spatialPhase = instancePhase + grassBladeIndex * 0.43
          + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.1;
        float broadWind = sin(uGrassTime * 0.82 + spatialPhase) * 0.018;
        float fineWind = sin(uGrassTime * 1.73 + spatialPhase * 1.61) * 0.008;
        float crossWind = cos(uGrassTime * 0.67 + spatialPhase * 1.23) * 0.012;
        transformed.x += (grassBend.x + broadWind + fineWind) * bendWeight;
        transformed.z += (grassBend.y + crossWind + fineWind * 0.45) * bendWeight;
        vGrassHeight = grassHeight;
        vGrassUv = uv;
        vGrassVariation = 0.92 + 0.08 * sin(instancePhase * 2.37);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uGrassBaseColor;
        uniform vec3 uGrassTipColor;
        varying float vGrassHeight;
        varying float vGrassVariation;
        varying vec2 vGrassUv;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float bladeLight = mix(0.74, 1.14, smoothstep(0.02, 1.0, vGrassHeight));
        float edgeFactor = abs(vGrassUv.x - 0.5) * 2.0;
        float centerCrease = 1.0 - pow(edgeFactor, 1.8) * 0.18;
        float rimGlow = 0.96 + 0.12 * smoothstep(0.65, 1.0, edgeFactor);
        vec3 bladeColor = mix(uGrassBaseColor, uGrassTipColor, pow(vGrassHeight, 0.88));
        diffuseColor.rgb = bladeColor * (bladeLight * centerCrease * rimGlow) * vGrassVariation;`,
      );
  };
  material.customProgramCacheKey = () => "portfolio-fluffy-grass-v4";
  return material;
}

export function createGrassField(scene, collider, groundY, distanceField) {
  const isCompact = window.innerWidth < 680;
  const tuftCount = isCompact ? 72 : 110;
  const { geometry, bladeTemplates } = createTuftGeometry();
  const bendValues = Array.from(
    { length: PACKED_BEND_ATTRIBUTE_COUNT },
    () => new Float32Array(tuftCount * 4),
  );
  const bendAttributes = bendValues.map(
    (values) => new THREE.InstancedBufferAttribute(values, 4),
  );
  const phaseValues = new Float32Array(tuftCount);
  const phaseAttribute = new THREE.InstancedBufferAttribute(phaseValues, 1);
  bendAttributes.forEach((attribute, index) => {
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(`instanceBend${index}`, attribute);
  });
  geometry.setAttribute("instancePhase", phaseAttribute);

  const timeUniform = { value: 0 };
  const colorUniforms = {
    base: { value: new THREE.Color(0x52662e) },
    tip: { value: new THREE.Color(0xc0a957) },
  };
  const material = createGrassMaterial(timeUniform, colorUniforms);
  const mesh = new THREE.InstancedMesh(geometry, material, tuftCount);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  scene.add(mesh);

  const random = seededRandom();
  const states = [];
  const matrix = new THREE.Matrix4();
  const orientation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const root = new THREE.Vector3();

  for (let index = 0; index < tuftCount; index += 1) {
    const fieldAngle = index * Math.PI * (3 - Math.sqrt(5)) + (random() - 0.5) * 0.2;
    const fieldRadius = Math.sqrt((index + 0.45) / tuftCount);
    const edgeTaper = THREE.MathUtils.smoothstep(1 - fieldRadius, 0, 0.26);
    const x = Math.cos(fieldAngle) * fieldRadius * 1.18 + (random() - 0.5) * 0.08;
    const z = Math.sin(fieldAngle) * fieldRadius * 0.74 + (random() - 0.5) * 0.05;
    const height = (0.39 + random() * 0.18) * THREE.MathUtils.lerp(0.48, 1, edgeTaper);
    const rotation = random() * Math.PI * 2;
    root.set(x, groundY, z);
    orientation.setFromAxisAngle(UP, rotation);
    scale.set(1, height, 1);
    matrix.compose(root, orientation, scale);
    mesh.setMatrixAt(index, matrix);
    phaseValues[index] = random() * Math.PI * 2;

    states.push({
      root: root.clone(),
      height,
      phase: phaseValues[index],
      rotationCos: Math.cos(rotation),
      rotationSin: Math.sin(rotation),
      blades: bladeTemplates.map(() => ({
        bend: new THREE.Vector2(),
        velocity: new THREE.Vector2(),
        frequency: 7 + random() * 1.8,
        dampingRatio: 0.98 + random() * 0.08,
      })),
    });
  }
  mesh.instanceMatrix.needsUpdate = true;
  phaseAttribute.needsUpdate = true;

  if (!distanceField) throw new Error("The precomputed grass collision field is missing.");
  const distanceFieldBuildTime = 0;
  const inverseOrientation = new THREE.Quaternion();
  const probePoint = new THREE.Vector3();
  const tuftCenter = new THREE.Vector3();
  const localPoint = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const localSurfacePoint = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const surfacePoint = new THREE.Vector3();
  const previousSurfacePoint = new THREE.Vector3();
  const surfaceDelta = new THREE.Vector3();
  const lateral = new THREE.Vector2();
  const flattenDirection = new THREE.Vector2();
  const startOrientation = new THREE.Quaternion();
  const stepPrevious = new THREE.Quaternion();
  const stepCurrent = new THREE.Quaternion();
  const startPosition = new THREE.Vector3();
  const stepPreviousPosition = new THREE.Vector3();
  const stepCurrentPosition = new THREE.Vector3();
  let collisionEvents = 0;
  let maximumBend = 0;
  let maximumPenetration = 0;

  function integrateBlade(blade, delta) {
    const stiffness = blade.frequency * blade.frequency;
    const damping = 2 * blade.dampingRatio * blade.frequency;
    blade.velocity.x += (-stiffness * blade.bend.x - damping * blade.velocity.x) * delta;
    blade.velocity.y += (-stiffness * blade.bend.y - damping * blade.velocity.y) * delta;
    blade.bend.addScaledVector(blade.velocity, delta);
  }

  function positionProbe(state, blade, template, bladeIndex, heightRatio, time) {
    const bendWeight = Math.pow(heightRatio, BEND_EXPONENT);
    const bladeWorldHeight = state.height * template.height;
    const normalizedBend = THREE.MathUtils.clamp(
      blade.bend.length() / Math.max(0.001, bladeWorldHeight),
      0,
      MAX_NORMALIZED_BEND,
    );
    const uprightScale = Math.sqrt(Math.max(0, 1 - normalizedBend * normalizedBend));
    const heightCompression = uprightScale;
    const curve = heightRatio * heightRatio;
    const templateX = template.rootX + template.leanX * curve;
    const templateZ = template.rootZ + template.leanZ * curve;
    const spatialPhase = state.phase + bladeIndex * 0.43
      + state.root.x * 1.7 + state.root.z * 2.1;
    const broadWind = Math.sin(time * 0.82 + spatialPhase) * 0.018;
    const fineWind = Math.sin(time * 1.73 + spatialPhase * 1.61) * 0.008;
    const windX = broadWind + fineWind;
    const windZ = Math.cos(time * 0.67 + spatialPhase * 1.23) * 0.012
      + fineWind * 0.45;
    const localX = templateX + windX * bendWeight;
    const localZ = templateZ + windZ * bendWeight;
    return probePoint.set(
      state.root.x + state.rotationCos * localX + state.rotationSin * localZ
        + blade.bend.x * bendWeight,
      state.root.y + bladeWorldHeight * heightRatio * heightCompression,
      state.root.z - state.rotationSin * localX + state.rotationCos * localZ
        + blade.bend.y * bendWeight,
    );
  }

  function resolveProbe(
    state,
    blade,
    template,
    bladeIndex,
    heightRatio,
    time,
    delta,
    previousColliderOrientation,
    currentColliderOrientation,
    previousColliderPosition,
    currentColliderPosition,
    sweepDistance,
    measureResidual,
  ) {
    const bendWeight = Math.pow(heightRatio, BEND_EXPONENT);
    positionProbe(state, blade, template, bladeIndex, heightRatio, time);
    localPoint
      .copy(probePoint)
      .sub(currentColliderPosition)
      .applyQuaternion(inverseOrientation);
    const signedDistance = distanceField.sampleDistance(localPoint);
    const effectiveRadius = COLLISION_RADIUS + Math.min(sweepDistance * 0.35, 0.04);
    if (!Number.isFinite(signedDistance) || signedDistance >= effectiveRadius) return false;

    if (signedDistance < 0) distanceField.sampleUnionNormal(localPoint, localNormal);
    else distanceField.sampleGradient(localPoint, localNormal);
    localSurfacePoint.copy(localPoint).addScaledVector(localNormal, -signedDistance);
    surfacePoint
      .copy(localSurfacePoint)
      .applyQuaternion(currentColliderOrientation)
      .add(currentColliderPosition);
    previousSurfacePoint
      .copy(localSurfacePoint)
      .applyQuaternion(previousColliderOrientation)
      .add(previousColliderPosition);
    worldNormal.copy(localNormal).applyQuaternion(currentColliderOrientation).normalize();
    const penetration = Math.min(
      COLLISION_RADIUS * 2.8,
      effectiveRadius - signedDistance,
    );
    surfaceDelta.subVectors(surfacePoint, previousSurfacePoint);
    lateral.set(worldNormal.x, worldNormal.z);
    let lateralAuthority = lateral.length();
    if (lateralAuthority < 1e-4) {
      lateral.set(surfaceDelta.x, surfaceDelta.z);
      lateralAuthority = 0.24;
    }
    if (lateral.lengthSq() < 1e-7) {
      lateral.set(probePoint.x - state.root.x, probePoint.z - state.root.z);
      lateralAuthority = 0.24;
    }
    if (lateral.lengthSq() < 1e-7) {
      lateral.set(1, 0);
      lateralAuthority = 0.24;
    }
    lateral.normalize();

    const flattenWeight = THREE.MathUtils.smoothstep(-worldNormal.y, 0.2, 0.92);
    if (flattenWeight > 0) {
      flattenDirection.copy(blade.bend);
      if (flattenDirection.lengthSq() < 1e-7) flattenDirection.copy(lateral);
      else flattenDirection.normalize();
      lateral.lerp(flattenDirection, flattenWeight).normalize();
      lateralAuthority = THREE.MathUtils.lerp(
        lateralAuthority,
        1,
        flattenWeight,
      );
    }

    const bendCorrection = penetration
      / (Math.max(0.1, bendWeight) * Math.max(0.24, lateralAuthority));
    blade.bend.addScaledVector(lateral, bendCorrection);
    const inverseDelta = 1 / Math.max(delta, 1 / 1000);
    blade.velocity.multiplyScalar(0.78);
    blade.velocity.x += surfaceDelta.x * inverseDelta * 0.32 * bendWeight;
    blade.velocity.y += surfaceDelta.z * inverseDelta * 0.32 * bendWeight;
    blade.velocity.addScaledVector(lateral, penetration * inverseDelta * 0.012);

    const maximumOffset = state.height * template.height * MAX_NORMALIZED_BEND;
    if (blade.bend.lengthSq() > maximumOffset * maximumOffset) {
      blade.bend.setLength(maximumOffset);
    }
    if (measureResidual) {
      positionProbe(state, blade, template, bladeIndex, heightRatio, time);
      localPoint
        .copy(probePoint)
        .sub(currentColliderPosition)
        .applyQuaternion(inverseOrientation);
      const residualDistance = distanceField.sampleDistance(localPoint);
      const residualPenetration = -residualDistance;
      if (
        Number.isFinite(residualPenetration)
        && residualPenetration > maximumPenetration
      ) {
        maximumPenetration = residualPenetration;
      }
    }
    return true;
  }

  function physicsStep(
    time,
    delta,
    previousColliderOrientation,
    currentColliderOrientation,
    previousColliderPosition,
    currentColliderPosition,
  ) {
    inverseOrientation.copy(currentColliderOrientation).invert();
    const sweepDistance = Math.min(
      collider.radius * previousColliderOrientation.angleTo(currentColliderOrientation)
        + previousColliderPosition.distanceTo(currentColliderPosition),
      collider.radius * 0.3,
    );

    states.forEach((state) => {
      state.blades.forEach((blade) => integrateBlade(blade, delta));

      tuftCenter
        .set(state.root.x, state.root.y + state.height * 0.52, state.root.z)
        .sub(currentColliderPosition)
        .applyQuaternion(inverseOrientation);
      const broadphaseRadius = state.height * 0.72 + CONTACT_SEARCH_RADIUS + sweepDistance;
      const canContact = distanceField.bounds.distanceToPoint(tuftCenter) <= broadphaseRadius;

      state.blades.forEach((blade, bladeIndex) => {
        const template = bladeTemplates[bladeIndex];
        if (canContact) {
          for (let iteration = 0; iteration < CONTACT_SOLVER_ITERATIONS; iteration += 1) {
            PROBE_LEVELS.forEach((heightRatio) => {
              if (
                resolveProbe(
                  state,
                  blade,
                  template,
                  bladeIndex,
                  heightRatio,
                  time,
                  delta,
                  previousColliderOrientation,
                  currentColliderOrientation,
                  previousColliderPosition,
                  currentColliderPosition,
                  sweepDistance,
                  iteration === CONTACT_SOLVER_ITERATIONS - 1,
                )
              ) {
                collisionEvents += 1;
              }
            });
          }
        }

        const bladeHeight = state.height * template.height;
        const maximumOffset = bladeHeight * MAX_NORMALIZED_BEND;
        if (blade.bend.lengthSq() > maximumOffset * maximumOffset) {
          blade.bend.setLength(maximumOffset);
        }
        const maximumVelocity = bladeHeight * 5.2;
        if (blade.velocity.lengthSq() > maximumVelocity * maximumVelocity) {
          blade.velocity.setLength(maximumVelocity);
        }

      });
    });
  }

  function updateBendAttributes() {
    maximumBend = 0;
    states.forEach((state, index) => {
      state.blades.forEach((blade, bladeIndex) => {
        maximumBend = Math.max(maximumBend, blade.bend.length());
        const attributeIndex = Math.floor(bladeIndex / 2);
        const attributeOffset = index * 4 + (bladeIndex % 2) * 2;
        bendValues[attributeIndex][attributeOffset] =
          state.rotationCos * blade.bend.x - state.rotationSin * blade.bend.y;
        bendValues[attributeIndex][attributeOffset + 1] =
          state.rotationSin * blade.bend.x + state.rotationCos * blade.bend.y;
      });
    });
    bendAttributes.forEach((attribute) => {
      attribute.needsUpdate = true;
    });
  }

  function update(
    time,
    frameDelta,
    previousColliderOrientation,
    currentColliderOrientation,
    previousColliderPosition,
    currentColliderPosition,
  ) {
    timeUniform.value = time;
    maximumPenetration = 0;
    const timeSubsteps = Math.ceil(frameDelta / MAX_TIME_PER_SUBSTEP);
    const rotationSubsteps = Math.ceil(
      previousColliderOrientation.angleTo(currentColliderOrientation) / MAX_ROTATION_PER_SUBSTEP,
    );
    const translationSubsteps = Math.ceil(
      previousColliderPosition.distanceTo(currentColliderPosition)
        / MAX_TRANSLATION_PER_SUBSTEP,
    );
    const substeps = Math.min(
      24,
      Math.max(1, timeSubsteps, rotationSubsteps, translationSubsteps),
    );
    const substepDelta = frameDelta / substeps;
    startOrientation.copy(previousColliderOrientation);
    startPosition.copy(previousColliderPosition);

    for (let step = 0; step < substeps; step += 1) {
      stepPrevious.copy(startOrientation).slerp(currentColliderOrientation, step / substeps);
      stepCurrent
        .copy(startOrientation)
        .slerp(currentColliderOrientation, (step + 1) / substeps);
      stepPreviousPosition
        .copy(startPosition)
        .lerp(currentColliderPosition, step / substeps);
      stepCurrentPosition
        .copy(startPosition)
        .lerp(currentColliderPosition, (step + 1) / substeps);
      physicsStep(
        time + substepDelta * step,
        substepDelta,
        stepPrevious,
        stepCurrent,
        stepPreviousPosition,
        stepCurrentPosition,
      );
    }
    updateBendAttributes();
  }

  function setTheme(theme) {
    colorUniforms.base.value.setHex(theme === "dark" ? 0x5e6e34 : 0x52662e);
    colorUniforms.tip.value.setHex(theme === "dark" ? 0xc8b05d : 0xc0a957);
  }

  updateBendAttributes();

  return {
    update,
    setTheme,
    get collisionEvents() {
      return collisionEvents;
    },
    get maximumBend() {
      return maximumBend;
    },
    get maximumPenetration() {
      return maximumPenetration;
    },
    get initializationMilliseconds() {
      return distanceFieldBuildTime;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
