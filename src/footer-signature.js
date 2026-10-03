import recording from "./assets/signature/caleb.json";
import { signatureSegments, signatureSVG } from "./lib/signature.js";

export function initFooterSignature() {
  const signature = document.querySelector("[data-footer-signature]");
  if (!signature || signature.dataset.signatureState === "complete") return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let observer;
  let svg;
  let animations = [];
  let disposed = false;

  function finish() {
    observer?.disconnect();
    // Restore the exact exported artwork when playback settles or is interrupted.
    signature.dataset.signatureState = "complete";
    svg?.remove();
    svg = undefined;
    for (const animation of animations) animation.cancel();
    animations = [];
  }

  function draw() {
    if (disposed || signature.dataset.signatureState !== "pending") return;
    if (reducedMotion.matches || document.hidden) { finish(); return; }
    observer?.disconnect();
    const template = document.createElement("template");
    template.innerHTML = signatureSVG(recording);
    svg = template.content.firstElementChild;
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    svg.removeAttribute("aria-labelledby");
    svg.querySelector("title")?.remove();
    const pieces = [...svg.querySelectorAll("path, circle")];
    const segments = signatureSegments(recording);
    // Hide every piece before inserting it; round line caps otherwise leave dots
    // at the start of future segments even when their dash offset is fully hidden.
    for (const piece of pieces) piece.style.opacity = "0";
    signature.append(svg);
    signature.dataset.signatureState = "drawing";
    animations = pieces.map((piece, index) => {
      const segment = segments[index];
      if (segment.dot) {
        return piece.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 1, delay: segment.start.time + 120, fill: "both",
        });
      }
      piece.setAttribute("pathLength", "1");
      piece.style.strokeDasharray = "1";
      return piece.animate([
        { opacity: 0, strokeDashoffset: 1, offset: 0 },
        { opacity: 1, strokeDashoffset: 0.999, offset: 0.001 },
        { opacity: 1, strokeDashoffset: 0, offset: 1 },
      ], {
        duration: Math.max(1, segment.end.time - segment.start.time),
        delay: segment.start.time + 120,
        easing: "linear",
        fill: "both",
      });
    });
    Promise.all(animations.map(animation => animation.finished.catch(() => {})))
      .then(() => { if (!disposed) finish(); });
  }

  const onMotionChange = () => { if (reducedMotion.matches) finish(); };
  const onVisibilityChange = () => {
    if (document.hidden && signature.dataset.signatureState === "drawing") finish();
  };
  reducedMotion.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibilityChange);

  if (reducedMotion.matches || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) {
    finish();
  } else {
    signature.dataset.signatureState = "pending";
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) draw();
    }, { threshold: 0.5 });
    observer.observe(signature);
  }

  return () => {
    disposed = true;
    finish();
    reducedMotion.removeEventListener("change", onMotionChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
