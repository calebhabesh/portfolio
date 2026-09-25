import React from "react";
import { createRoot } from "react-dom/client";
import { ProjectsList } from "./components/ProjectsList";

const container = document.getElementById("projects-root");

if (container) {
  const root = createRoot(container);
  root.render(<ProjectsList />);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      root.unmount();
    });
  }
}
