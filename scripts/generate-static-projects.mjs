import fs from "node:fs/promises";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

// Use the exact client tree, including the card structure and React text
// boundaries, so hydration reuses every card and image instead of repainting it.
export async function renderProjectsHtml() {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { ProjectsList } = await server.ssrLoadModule("/src/components/ProjectsList.tsx");
    return renderToString(React.createElement(ProjectsList));
  } finally {
    await server.close();
  }
}

async function updateIndexHtml() {
  const projectsHtml = await renderProjectsHtml();
  const indexPath = new URL("../index.html", import.meta.url).pathname;
  let html = await fs.readFile(indexPath, "utf-8");

  const startMarker = "<!-- PROJECTS_START -->";
  const endMarker = "<!-- PROJECTS_END -->";

  const region = /(<div id="projects-root" class="projects-list">)\s*<!-- PROJECTS_START -->[\s\S]*?<!-- PROJECTS_END -->\s*(<\/div>)/;
  if (!region.test(html)) throw new Error("Static projects region is missing from index.html.");
  // Whitespace text nodes inside the hydration root must match React's tree too.
  html = html.replace(region, (_match, open, close) =>
    `${open}${startMarker}${projectsHtml}${endMarker}${close}`,
  );

  await fs.writeFile(indexPath, html, "utf-8");
  console.log("Updated index.html with static projects output.");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  updateIndexHtml().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
