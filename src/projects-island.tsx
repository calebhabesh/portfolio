import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ProjectsList } from "./components/ProjectsList";

const container = document.getElementById("projects-root");

if (container) {
  // Keep the original animated shells and their compositor timelines alive.
  // React owns their contents via portals and the separate dialog host.
  const cardContainers = new Map(
    [...container.querySelectorAll<HTMLElement>(".project-card-animate")]
      .map((card) => {
        card.dataset.projectId ||= card.querySelector<HTMLElement>("[data-project]")!.dataset.project!;
        return [card.dataset.projectId, card] as const;
      }),
  );
  const host = document.createElement("div");
  host.style.display = "contents";
  container.append(host);
  const root = createRoot(host);
  flushSync(() => {
    for (const card of cardContainers.values()) card.replaceChildren();
    root.render(<ProjectsList cardContainers={cardContainers} />);
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      root.unmount();
      host.remove();
    });
  }
}
