import React from "react";
import { hydrateRoot } from "react-dom/client";
import { ProjectsList } from "./components/ProjectsList";

let root: ReturnType<typeof hydrateRoot> | undefined;
const container = document.getElementById("projects-root");

// Attach interactions to the static cards while the emblem assets load.
// Their entrance is controlled by the separate reveal observer.
export const projectInteractionsReady = new Promise<void>((resolve) => {
  if (!container) {
    resolve();
    return;
  }
  const observer = new MutationObserver(() => {
    if (container.dataset.interactive !== "true") return;
    observer.disconnect();
    clearTimeout(fallbackTimer);
    resolve();
  });
  const fallbackTimer = setTimeout(() => {
    observer.disconnect();
    resolve();
  }, 1500);
  observer.observe(container, { attributes: true, attributeFilter: ["data-interactive"] });
  root = hydrateRoot(container, <ProjectsList />);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    root?.unmount();
    root = undefined;
  });
}
