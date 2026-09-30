export const entranceSelector = ".project-card-animate";

// Static card shells retain ownership of their entrances after React mounts.
// Give the emblem a brief chance to render before the initial card entrances.
// Release the cards promptly if loading takes longer or fails.
export const projectEntranceReady = new Promise((resolve) => {
  const stage = document.querySelector("[data-emblem-stage]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!stage || reducedMotion.matches) {
    resolve();
    return;
  }

  let observer;
  let settleTimer;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    clearTimeout(settleTimer);
    observer?.disconnect();
    reducedMotion.removeEventListener("change", onMotionChange);
    resolve();
  };
  const onMotionChange = () => { if (reducedMotion.matches) finish(); };
  const checkModel = () => {
    if (stage.dataset.modelState === "error") finish();
    else if (stage.dataset.rendered === "true" && stage.dataset.motionPrimed === "true" && ["ready", "error"].includes(stage.dataset.physicsState) && settleTimer === undefined) {
      // Let the emblem show its first animated frame before revealing cards.
      settleTimer = setTimeout(finish, 120);
    }
  };
  const fallbackTimer = setTimeout(finish, 280);
  observer = new MutationObserver(checkModel);
  observer.observe(stage, { attributes: true, attributeFilter: ["data-rendered", "data-motion-primed", "data-model-state", "data-physics-state"] });
  reducedMotion.addEventListener("change", onMotionChange);
  checkModel();
});

// Reveal the prepared model after active card entrances have painted their final frame.
export async function waitForProjectEntrances() {
  const animations = [...document.querySelectorAll(entranceSelector)]
    .flatMap((card) => card.getAnimations({ subtree: true }))
    .filter((animation) => animation.playState === "running");
  await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  if (animations.length && !document.hidden) {
    // Animation.finished can resolve before its final paint. Leave one frame
    // for animationend cleanup, then reveal the prepared model.
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return animations.length > 0 && !document.hidden;
}
