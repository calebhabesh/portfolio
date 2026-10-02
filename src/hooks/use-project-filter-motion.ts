import { type RefObject } from "react";

// Search takes over below-fold entrances once. The slot frames stay mounted
// and drawn; only their contents participate in the result crossfade.
export function useProjectFilterMotion(listRef: RefObject<HTMLDivElement | null>) {
  return () => {
    for (const card of listRef.current?.querySelectorAll<HTMLElement>(".project-card-animate") || []) {
      card.dataset.cardReveal = "settled";
      card.classList.add("is-visible");
    }
    window.dispatchEvent(new Event("portfolio:project-filter"));
  };
}
