import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeToMotion = (notify: () => void) => {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const motionPreference = () => window.matchMedia(reducedMotionQuery).matches;

export interface ProjectOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExpansionOptions {
  dialog: RefObject<HTMLDivElement | null>;
  surface: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  backdrop: RefObject<HTMLDivElement | null>;
  origin: ProjectOrigin | null;
  projectId: string | undefined;
  closing: boolean;
  onClosed: () => void;
}

// Only the paper surface scales. Content keeps its final layout throughout,
// so text, gallery changes and scroll positions never join a layout morph.
export function useProjectExpansion({ dialog, surface, content, backdrop, origin, projectId, closing, onClosed }: ExpansionOptions) {
  const reduceMotion = useSyncExternalStore(subscribeToMotion, motionPreference, () => true);
  useLayoutEffect(() => {
    const panel = dialog.current;
    const paper = surface.current;
    const details = content.current;
    const scrim = backdrop.current;
    if (!projectId || !panel || !paper || !details || !scrim) return;

    const elements = [paper, details, scrim];
    const reset = () => elements.forEach(element => {
      element.style.removeProperty("transform");
      element.style.removeProperty("opacity");
      element.style.removeProperty("will-change");
    });
    if (reduceMotion || !paper.animate) {
      reset();
      if (closing) onClosed();
      return;
    }

    const target = panel.getBoundingClientRect();
    const source = closing
      ? document.querySelector(`[data-project="${projectId}"]`)?.getBoundingClientRect()
      : origin;
    const visibleSource = source && source.width > 0 && source.height > 0
      && source.y < innerHeight && source.y + source.height > 0;
    const folded = visibleSource
      ? `translate(${source.x - target.x}px, ${source.y - target.y}px) scale(${source.width / target.width}, ${source.height / target.height})`
      : "translate(0px, 16px) scale(0.98)";
    const current = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return { transform: style.transform, opacity: style.opacity };
    };
    const duration = closing ? 220 : 340;
    const easing = closing ? "cubic-bezier(0.4, 0, 0.8, 0.2)" : "cubic-bezier(0.22, 1, 0.36, 1)";
    elements.forEach(element => { element.style.willChange = "transform, opacity"; });
    const animations = [
      paper.animate(closing
        ? [current(paper), { transform: folded, opacity: visibleSource ? 1 : 0 }]
        : [{ transform: folded, opacity: visibleSource ? 1 : 0 }, { transform: "none", opacity: 1 }],
      { duration, easing, fill: "both" }),
      details.animate(closing
        ? [current(details), { opacity: 0, transform: "translateY(6px)" }]
        : [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }],
      { duration: closing ? 90 : 240, delay: closing ? 0 : 60, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }),
      scrim.animate(closing ? [{ opacity: current(scrim).opacity }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 1 }],
      { duration: closing ? duration : 180, fill: "both" }),
    ];
    let disposed = false;
    const finish = () => {
      if (disposed) return;
      disposed = true;
      if (closing) {
        // Hold the landed frame until React removes the dialog. Clearing its
        // transform here could flash the full-size panel during the handoff.
        onClosed();
        return;
      }
      animations.forEach(animation => animation.cancel());
      reset();
    };
    void Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    // A rotated phone or resized window uses the new layout immediately.
    // Do not keep a transform whose destination was measured in an old viewport.
    window.addEventListener("resize", finish, { once: true });
    window.visualViewport?.addEventListener("resize", finish, { once: true });
    return () => {
      window.removeEventListener("resize", finish);
      window.visualViewport?.removeEventListener("resize", finish);
      if (!disposed) {
        // Snapshot before cancelling so an early close reverses the visible
        // surface, rather than jumping to the end of its opening animation.
        elements.forEach(element => Object.assign(element.style, current(element)));
      }
      animations.forEach(animation => animation.cancel());
      disposed = true;
      elements.forEach(element => element.style.removeProperty("will-change"));
    };
  }, [projectId, closing, reduceMotion, dialog, surface, content, backdrop, origin, onClosed]);
}
