// Static card shells retain ownership of their entrances after React mounts.
// Bound the wait so model downloads never hold up the project list indefinitely.
export const projectEntranceReady = new Promise((resolve) => {
  const stage = document.querySelector("[data-emblem-stage]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stageVisible = () => {
    const bounds = stage?.getBoundingClientRect();
    return bounds && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };
  if (!stage || reducedMotion.matches || !stageVisible()) {
    resolve();
    return;
  }

  let leadTimer;
  let observer;
  const finish = () => {
    clearTimeout(fallbackTimer);
    clearTimeout(leadTimer);
    observer?.disconnect();
    window.removeEventListener("scroll", onScroll);
    reducedMotion.removeEventListener("change", onMotionChange);
    resolve();
  };
  const onScroll = () => { if (!stageVisible()) finish(); };
  const onMotionChange = () => { if (reducedMotion.matches) finish(); };
  const checkModel = () => {
    if (stage.dataset.modelState === "error") finish("error");
    else if (stage.dataset.rendered === "true" && leadTimer === undefined) {
      leadTimer = setTimeout(() => finish("model-rendered"), 120);
    }
  };
  const fallbackTimer = setTimeout(() => finish("fallback-timer"), 280);
  observer = new MutationObserver(checkModel);
  observer.observe(stage, { attributes: true, attributeFilter: ["data-rendered", "data-model-state"] });
  window.addEventListener("scroll", onScroll, { passive: true });
  reducedMotion.addEventListener("change", onMotionChange);
  checkModel();
});

// If downloads finish after the fallback, let the visible entrances complete
// before parsing the model, uploading textures, and compiling its shaders.
export async function waitForProjectEntrances() {
  const animations = [...document.querySelectorAll(".project-card-animate")]
    .flatMap((card) => card.getAnimations())
    .filter((animation) => animation.playState === "running");
  await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
}
