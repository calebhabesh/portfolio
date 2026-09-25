import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createGrassField } from "./grass-field.js";
import { parseCollisionField } from "./collision-field.js";
import {
  createRelicNormalMap,
  createRelicRoughnessMap,
  createStudioEnvironment,
  upgradeToPhysicalMaterial,
} from "./emblem-textures.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const MODEL_HEIGHT = 1.94;
const MODEL_CENTER_Y = 0;
const GROUND_Y = -0.89;
const FLOOR_CLEARANCE = 0.035;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const DRAG_SENSITIVITY = 0.52;
const MAX_DRAG_ANGULAR_SPEED = 4.8;
const MAX_RELEASE_SPEED = 1.35;
const MAX_RETURN_ANGULAR_SPEED = 1.85;
const SWIVEL_DRIVE_STRENGTH = 2.4;
const RETURN_SPRING_STRENGTH = 16.0;
const RETURN_DAMPING = 2.6;
const MAX_RETURN_ACCELERATION = 16.0;
const AMBIENT_ANGULAR_VELOCITY = new THREE.Vector3(0, 0.4, 0);
const CRUISE_ANGULAR_SPEED = AMBIENT_ANGULAR_VELOCITY.length();

function createShadowTexture() {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 256;
  shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 64, 5, 128, 64, 122);
  gradient.addColorStop(0, "rgba(5, 15, 10, .34)");
  gradient.addColorStop(0.46, "rgba(5, 15, 10, .16)");
  gradient.addColorStop(1, "rgba(5, 15, 10, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(shadowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function measureModelSafetyRadius(model, emblem) {
  emblem.updateWorldMatrix(true, true);
  const emblemInverse = new THREE.Matrix4().copy(emblem.matrixWorld).invert();
  const relativeMatrix = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  let radius = 0;

  model.traverse((object) => {
    const positions = object.geometry?.attributes?.position;
    if (!object.isMesh || !positions) return;
    relativeMatrix.multiplyMatrices(emblemInverse, object.matrixWorld);
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(relativeMatrix);
      radius = Math.max(radius, vertex.length());
    }
  });
  return radius;
}

export async function initEmblemScene(stage, assets) {
  let disposed = false;
  let model = null;
  const canvas = stage.querySelector("#emblem-canvas");
  const status = stage.querySelector("[data-emblem-status]");
  if (!canvas) throw new Error("The emblem canvas is missing.");
  if (!assets?.modelBufferPromise || !assets?.collisionFieldBufferPromise) {
    throw new Error("The emblem assets were not preloaded.");
  }

  stage.dataset.physicsState = "loading";
  const collisionFieldPromise = Promise.resolve(assets.collisionFieldBufferPromise)
    .then((buffer) => parseCollisionField(buffer));

  canvas.tabIndex = 0;

  let renderer;
  const rendererConfigs = [
    { canvas, alpha: true, antialias: true, powerPreference: "high-performance" },
    { canvas, alpha: true, antialias: true, powerPreference: "default" },
    { canvas, alpha: true, antialias: true },
    { canvas, alpha: true, antialias: false },
  ];
  for (const config of rendererConfigs) {
    try {
      renderer = new THREE.WebGLRenderer(config);
      break;
    } catch {
      // Try next configuration
    }
  }
  if (!renderer) {
    throw new Error("WebGL is not available in this browser.");
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = document.documentElement.dataset.theme === "dark" ? 1.18 : 1.08;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.16, 4.5);
  camera.lookAt(0, 0.02, 0);

  const initialTheme = document.documentElement.dataset.theme || "light";
  const ambient = new THREE.HemisphereLight(
    0xfff8e8,
    0x315e45,
    initialTheme === "dark" ? 1.4 : 1.6,
  );
  const keyLeft = new THREE.DirectionalLight(0xfff1d6, 2.1);
  keyLeft.position.set(-3.2, 3.5, 4.0);
  const keyRight = new THREE.DirectionalLight(0xfff1d6, 2.1);
  keyRight.position.set(3.2, 3.5, 4.0);
  const rim = new THREE.DirectionalLight(
    0xa8c8ff,
    initialTheme === "dark" ? 1.3 : 1.15,
  );
  rim.position.set(0.0, 3.0, -3.5);
  scene.add(ambient, keyLeft, keyRight, rim);

  const textures = {
    relicNormal: createRelicNormalMap(512),
    relicRoughness: createRelicRoughnessMap(512),
    albedoCache: {},
  };
  const studioEnv = createStudioEnvironment(renderer);
  scene.environment = studioEnv;
  scene.environmentRotation.set(0, -0.22, 0);

  const shadowTexture = createShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: document.documentElement.dataset.theme === "dark" ? 0.4 : 0.62,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.95), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, GROUND_Y + 0.003, 0.02);
  scene.add(shadow);

  const emblem = new THREE.Group();
  scene.add(emblem);

  if (MeshoptDecoder?.ready) {
    await MeshoptDecoder.ready;
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (status && status.lastChild) status.lastChild.textContent = " Loading emblem";
  const gltf = await loader.parseAsync(await assets.modelBufferPromise, "");
  if (disposed) {
    return { dispose, physicsReady: Promise.resolve() };
  }

  model = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = MODEL_HEIGHT / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  model.position.set(
    -center.x * scale,
    -center.y * scale + MODEL_CENTER_Y,
    -center.z * scale,
  );

  model.traverse((object) => {
    if (!object.isMesh) return;
    object.frustumCulled = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const upgraded = materials.map((material) => {
      if (!material) return material;
      return upgradeToPhysicalMaterial(material, textures, "ancient-coin");
    });
    object.material = Array.isArray(object.material) ? upgraded : upgraded[0];
  });
  emblem.add(model);

  const floorSafetyRadius = measureModelSafetyRadius(model, emblem);
  const fixedPivotY = Math.max(
    0,
    GROUND_Y + FLOOR_CLEARANCE + floorSafetyRadius,
  );
  emblem.position.y = fixedPivotY;
  let grass = null;
  stage.dataset.collisionBuildMs = "0.0";
  stage.dataset.collisionEvents = "0";
  stage.dataset.grassBend = "0.00000";
  stage.dataset.grassPenetration = "0.00000";

  const initialOrientation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-0.025, 0, 0, "XYZ"),
  );
  const ambientOrientation = initialOrientation.clone();
  const motion = {
    current: initialOrientation.clone(),
    angularVelocity: new THREE.Vector3(),
    dragAngularSpeed: 0,
    dragging: false,
    returning: false,
    pointerId: null,
    lastPointer: new THREE.Vector2(),
    lastPointerTime: null,
    hasPointerMotion: false,
  };
  emblem.quaternion.copy(motion.current);

  stage.dataset.modelState = "ready";
  stage.dataset.modelReadyMs = (performance.now() - assets.startedAt).toFixed(1);
  if (status) status.lastChild.textContent = " Emblem ready · preparing grass physics";
  stage.dispatchEvent(new CustomEvent("emblem:model-ready", { bubbles: true }));

  const physicsReadyPromise = collisionFieldPromise
    .then((distanceField) => {
      if (disposed) return;
      if (Math.abs(distanceField.floorSafetyRadius - floorSafetyRadius) > 0.002) {
        throw new Error("The precomputed collision field does not match the emblem model.");
      }
      grass = createGrassField(
        scene,
        { radius: distanceField.colliderRadius },
        GROUND_Y,
        distanceField,
      );
      grass.setTheme(document.documentElement.dataset.theme || "light");
      stage.dataset.physicsState = "ready";
      stage.dataset.physicsReadyMs = (performance.now() - assets.startedAt).toFixed(1);
      if (status) status.lastChild.textContent = " Emblem and swept grass collisions ready";
      stage.dispatchEvent(new CustomEvent("emblem:ready", { bubbles: true }));
    })
    .catch((error) => {
      console.error("The emblem grass physics could not start.", error);
      stage.dataset.physicsState = "error";
    });

  const rotationDelta = new THREE.Quaternion();
  const yawDelta = new THREE.Quaternion();
  const pitchDelta = new THREE.Quaternion();
  const rotationAxis = new THREE.Vector3();
  const sampledAngularVelocity = new THREE.Vector3();
  const inverseCurrentOrientation = new THREE.Quaternion();
  const returnError = new THREE.Quaternion();
  const returnAcceleration = new THREE.Vector3();
  const normalVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();
  const returnAxis = new THREE.Vector3();

  function updateTargetUprightOrientation(currentOrientation, outTarget) {
    normalVector.set(0, 0, 1).applyQuaternion(currentOrientation);
    const horizSq = normalVector.x * normalVector.x + normalVector.z * normalVector.z;
    let yaw;
    if (horizSq > 1e-6) {
      yaw = Math.atan2(normalVector.x, normalVector.z);
    } else {
      sideVector.set(1, 0, 0).applyQuaternion(currentOrientation);
      yaw = Math.atan2(-sideVector.z, sideVector.x);
    }
    outTarget.setFromAxisAngle(Y_AXIS, yaw).multiply(initialOrientation);
    return outTarget;
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    motion.dragging = true;
    motion.returning = false;
    motion.angularVelocity.set(0, 0, 0);
    motion.dragAngularSpeed = 0;
    motion.pointerId = event.pointerId;
    motion.lastPointerTime = event.timeStamp;
    motion.hasPointerMotion = false;
    motion.lastPointer.set(event.clientX, event.clientY);
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!motion.dragging || event.pointerId !== motion.pointerId) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const radiansPerPixel = (Math.PI * 2 * DRAG_SENSITIVITY) / Math.max(1, bounds.height);
    const yawAngle = (event.clientX - motion.lastPointer.x) * radiansPerPixel;
    const pitchAngle = (event.clientY - motion.lastPointer.y) * radiansPerPixel;
    yawDelta.setFromAxisAngle(Y_AXIS, yawAngle);
    pitchDelta.setFromAxisAngle(X_AXIS, pitchAngle);
    rotationDelta.multiplyQuaternions(pitchDelta, yawDelta).normalize();
    const rawAngle = 2 * Math.acos(THREE.MathUtils.clamp(rotationDelta.w, -1, 1));
    if (rawAngle > 1e-5) {
      rotationAxis.set(rotationDelta.x, rotationDelta.y, rotationDelta.z).normalize();
      const pointerDelta = THREE.MathUtils.clamp(
        (event.timeStamp - motion.lastPointerTime) / 1000,
        1 / 240,
        1 / 20,
      );
      const limitedAngle = Math.min(
        rawAngle,
        MAX_DRAG_ANGULAR_SPEED * pointerDelta,
      );
      motion.dragAngularSpeed = limitedAngle / pointerDelta;
      rotationDelta.setFromAxisAngle(rotationAxis, limitedAngle);
      motion.current.premultiply(rotationDelta).normalize();

      sampledAngularVelocity
        .copy(rotationAxis)
        .multiplyScalar(Math.min(MAX_RELEASE_SPEED, limitedAngle / pointerDelta));
      if (motion.hasPointerMotion) motion.angularVelocity.lerp(sampledAngularVelocity, 0.58);
      else motion.angularVelocity.copy(sampledAngularVelocity);
      motion.hasPointerMotion = true;
    }
    motion.lastPointer.set(event.clientX, event.clientY);
    motion.lastPointerTime = event.timeStamp;
  }

  function endPointer(event) {
    if (event.pointerId !== motion.pointerId) return;
    motion.dragging = false;
    motion.pointerId = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignored if capture already released
      }
    }

    if (reducedMotion.matches) {
      motion.angularVelocity.set(0, 0, 0);
      motion.returning = false;
      return;
    }

    const elapsedSinceMove = event.timeStamp - (motion.lastPointerTime || event.timeStamp);
    if (!motion.hasPointerMotion || elapsedSinceMove > 120) {
      motion.angularVelocity.set(0, CRUISE_ANGULAR_SPEED, 0);
    } else {
      if (motion.angularVelocity.y >= 0 && motion.angularVelocity.y < CRUISE_ANGULAR_SPEED) {
        motion.angularVelocity.y = CRUISE_ANGULAR_SPEED;
      }
      if (motion.angularVelocity.lengthSq() > MAX_RELEASE_SPEED * MAX_RELEASE_SPEED) {
        motion.angularVelocity.setLength(MAX_RELEASE_SPEED);
      }
    }

    updateTargetUprightOrientation(motion.current, ambientOrientation);
    const tiltOffset = motion.current.angleTo(ambientOrientation);
    const tiltVel = Math.hypot(motion.angularVelocity.x, motion.angularVelocity.z);
    const yawVelDiff = Math.abs(motion.angularVelocity.y - CRUISE_ANGULAR_SPEED);

    motion.returning = tiltOffset > 0.005 || tiltVel > 0.01 || yawVelDiff > 0.02;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("lostpointercapture", (event) => {
    if (!motion.dragging || event.pointerId !== motion.pointerId) return;
    endPointer(event);
  });

  canvas.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.32 : 0.15;
    let axis;
    let direction = 1;
    if (event.key === "Home") {
      updateTargetUprightOrientation(motion.current, ambientOrientation);
      motion.current.copy(ambientOrientation);
      if (reducedMotion.matches) motion.angularVelocity.set(0, 0, 0);
      else motion.angularVelocity.set(0, CRUISE_ANGULAR_SPEED, 0);
      motion.returning = false;
      event.preventDefault();
      return;
    } else if (event.key === "ArrowLeft") axis = Y_AXIS;
    else if (event.key === "ArrowRight") { axis = Y_AXIS; direction = -1; }
    else if (event.key === "ArrowUp") axis = new THREE.Vector3(1, 0, 0);
    else if (event.key === "ArrowDown") { axis = new THREE.Vector3(1, 0, 0); direction = -1; }
    else if (event.key.toLowerCase() === "q") axis = new THREE.Vector3(0, 0, 1);
    else if (event.key.toLowerCase() === "e") { axis = new THREE.Vector3(0, 0, 1); direction = -1; }
    else return;

    rotationDelta.setFromAxisAngle(axis, step * direction);
    motion.current.premultiply(rotationDelta).normalize();
    motion.angularVelocity.copy(axis).multiplyScalar(0.28 * direction);
    motion.returning = !reducedMotion.matches;
    if (reducedMotion.matches) motion.angularVelocity.set(0, 0, 0);
    event.preventDefault();
  });

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 520 ? 30 : 27;
    camera.position.z = width < 520 ? 4.8 : 4.4;
    camera.updateProjectionMatrix();
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  let isVisible = true;
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  });
  visibilityObserver.observe(stage);

  let previousTime = performance.now();
  let animationFrame;
  const previousOrientation = motion.current.clone();
  const previousColliderPosition = emblem.position.clone();

  function render(now) {
    animationFrame = requestAnimationFrame(render);
    const delta = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
    previousTime = now;
    if (!isVisible || document.hidden) return;

    if (!reducedMotion.matches) {
      if (!motion.dragging) {
        updateTargetUprightOrientation(motion.current, ambientOrientation);
        const tiltError = motion.current.angleTo(ambientOrientation);

        if (motion.returning) {
          inverseCurrentOrientation.copy(motion.current).invert();
          returnError
            .multiplyQuaternions(ambientOrientation, inverseCurrentOrientation)
            .normalize();
          if (returnError.w < 0) {
            returnError.x *= -1;
            returnError.y *= -1;
            returnError.z *= -1;
            returnError.w *= -1;
          }
          const returnAngle = 2 * Math.acos(
            THREE.MathUtils.clamp(returnError.w, -1, 1),
          );

          // Restoring torque acts strictly on the tilt axes (X and Z) so the swivel rotation (Y)
          // is never stopped, reversed, or frozen.
          returnAxis.set(returnError.x, 0, returnError.z);
          returnAcceleration.set(0, 0, 0);
          if (returnAxis.lengthSq() > 1e-8 && returnAngle > 1e-5) {
            returnAxis.normalize();
            returnAcceleration
              .copy(returnAxis)
              .multiplyScalar(returnAngle * RETURN_SPRING_STRENGTH);
          }
          returnAcceleration.x -= RETURN_DAMPING * motion.angularVelocity.x;
          returnAcceleration.z -= RETURN_DAMPING * motion.angularVelocity.z;

          if (returnAcceleration.lengthSq() > MAX_RETURN_ACCELERATION ** 2) {
            returnAcceleration.setLength(MAX_RETURN_ACCELERATION);
          }

          // Greased swivel drive on Y: smoothly converges toward cruising speed
          const yawAcceleration =
            (CRUISE_ANGULAR_SPEED - motion.angularVelocity.y) * SWIVEL_DRIVE_STRENGTH;

          motion.angularVelocity.x += returnAcceleration.x * delta;
          motion.angularVelocity.y += yawAcceleration * delta;
          motion.angularVelocity.z += returnAcceleration.z * delta;

          if (motion.angularVelocity.lengthSq() > MAX_RETURN_ANGULAR_SPEED ** 2) {
            motion.angularVelocity.setLength(MAX_RETURN_ANGULAR_SPEED);
          }

          const currentAngularSpeed = motion.angularVelocity.length();
          if (currentAngularSpeed > 1e-5) {
            rotationAxis.copy(motion.angularVelocity).multiplyScalar(1 / currentAngularSpeed);
            rotationDelta.setFromAxisAngle(rotationAxis, currentAngularSpeed * delta);
            motion.current.premultiply(rotationDelta).normalize();
          }

          // Seamless convergence check: critically damped settling with no visual hitch or snap
          const tiltVel = Math.hypot(motion.angularVelocity.x, motion.angularVelocity.z);
          const yawVelDiff = Math.abs(motion.angularVelocity.y - CRUISE_ANGULAR_SPEED);
          if (tiltError < 0.008 && tiltVel < 0.015 && yawVelDiff < 0.02) {
            motion.returning = false;
            motion.angularVelocity.set(0, CRUISE_ANGULAR_SPEED, 0);
            updateTargetUprightOrientation(motion.current, ambientOrientation);
          }
        } else {
          // Pure idle rotation: rotate around Y at CRUISE_ANGULAR_SPEED
          motion.angularVelocity.set(0, CRUISE_ANGULAR_SPEED, 0);
          rotationDelta.setFromAxisAngle(Y_AXIS, CRUISE_ANGULAR_SPEED * delta);
          motion.current.premultiply(rotationDelta).normalize();
          ambientOrientation.copy(motion.current);
        }
      } else {
        updateTargetUprightOrientation(motion.current, ambientOrientation);
      }
    }

    emblem.quaternion.copy(motion.current);
    emblem.updateMatrixWorld(true);
    stage.dataset.orientation = [
      motion.current.x,
      motion.current.y,
      motion.current.z,
      motion.current.w,
    ].map((value) => value.toFixed(5)).join(",");
    stage.dataset.orientationOffset = motion.current.angleTo(ambientOrientation).toFixed(5);
    stage.dataset.motionState = motion.dragging
      ? "dragging"
      : motion.returning ? "returning" : "idle";
    stage.dataset.floorClearance = (
      fixedPivotY - floorSafetyRadius - GROUND_Y
    ).toFixed(5);
    stage.dataset.pivotY = emblem.position.y.toFixed(5);
    stage.dataset.angularSpeed = motion.angularVelocity.length().toFixed(5);
    stage.dataset.dragAngularSpeed = motion.dragAngularSpeed.toFixed(5);

    if (grass) {
      const physicsStart = performance.now();
      grass.update(
        now / 1000,
        delta,
        previousOrientation,
        motion.current,
        previousColliderPosition,
        emblem.position,
      );
      stage.dataset.physicsMs = (performance.now() - physicsStart).toFixed(2);
      stage.dataset.collisionEvents = String(grass.collisionEvents);
      stage.dataset.grassBend = grass.maximumBend.toFixed(5);
      stage.dataset.grassPenetration = grass.maximumPenetration.toFixed(5);
    } else {
      stage.dataset.physicsMs = "0.00";
    }
    renderer.render(scene, camera);
    previousOrientation.copy(motion.current);
    previousColliderPosition.copy(emblem.position);
  }

  animationFrame = requestAnimationFrame(render);

  function updateTheme(event) {
    const theme = event.detail?.theme || document.documentElement.dataset.theme;
    grass?.setTheme(theme);
    renderer.toneMappingExposure = theme === "dark" ? 1.18 : 1.08;
    shadowMaterial.opacity = theme === "dark" ? 0.4 : 0.62;
    ambient.intensity = theme === "dark" ? 1.2 : 1.35;
    rim.intensity = theme === "dark" ? 1.4 : 1.2;
  }
  window.addEventListener("portfolio:theme", updateTheme);

  function dispose() {
    disposed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    window.removeEventListener("portfolio:theme", updateTheme);
    grass?.dispose();
    studioEnv?.dispose();
    textures?.relicNormal?.dispose();
    textures?.relicRoughness?.dispose();
    if (textures?.albedoCache) {
      Object.values(textures.albedoCache).forEach((tex) => tex?.dispose());
    }
    shadow?.geometry?.dispose();
    shadowMaterial?.dispose();
    shadowTexture?.dispose();
    model?.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
    renderer?.dispose();
    renderer?.forceContextLoss?.();
    delete window.__setEmblemStyle;
  }

  window.__setEmblemStyle = (styleName) => {
    model.traverse((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((mat) => {
        if (!mat) return;
        const newMat = upgradeToPhysicalMaterial(mat, textures, styleName);
        mat.roughness = newMat.roughness;
        mat.metalness = newMat.metalness;
        mat.clearcoat = newMat.clearcoat;
        mat.clearcoatRoughness = newMat.clearcoatRoughness;
        mat.sheen = newMat.sheen;
        mat.sheenRoughness = newMat.sheenRoughness;
        mat.normalMap = newMat.normalMap;
        mat.normalScale.copy(newMat.normalScale);
        mat.roughnessMap = newMat.roughnessMap;
        mat.map = newMat.map;
        mat.needsUpdate = true;
        newMat.dispose();
      });
    });
  };

  window.addEventListener("pagehide", dispose, { once: true });
  return { dispose, physicsReady: physicsReadyPromise };
}
