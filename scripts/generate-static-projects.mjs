import fs from "node:fs/promises";
import { projects } from "../src/data/projects.ts";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderProjectsHtml() {
  return projects
    .map((project, index) => {
      const isEven = index % 2 === 0;
      const direction = isEven ? "left" : "right";
      const primaryLink = project.links[0] || null;
      const previewImage = project.images?.[0];
      const imageCount = project.images?.length || 0;
      const previewMarkup = previewImage ? `
              <a class="project-card-preview" href="${escapeHtml(previewImage.src)}" style="--photo-stack-second: url('${escapeHtml(project.images?.[1]?.src || previewImage.src)}'); --photo-stack-third: url('${escapeHtml(project.images?.[2]?.src || previewImage.src)}')" aria-label="View ${imageCount} ${imageCount === 1 ? "Image" : "Images"} for ${escapeHtml(project.title)}">
                <span class="project-card-preview-face">
                <img src="${escapeHtml(previewImage.src)}" alt="${escapeHtml(previewImage.alt)}" width="${previewImage.width}" height="${previewImage.height}" loading="lazy" decoding="async">
                <span class="project-card-preview-label" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="3" width="15" height="15" rx="2" />
                    <path d="M3 7v12a2 2 0 0 0 2 2h12M6 14l4-4 4 4 3-3 4 4" />
                    <circle cx="16" cy="7" r="1" />
                  </svg>
                  ${imageCount} ${imageCount === 1 ? "Image" : "Images"}
                  <span class="project-card-preview-arrow">↗</span>
                </span>
                </span>
              </a>` : "";

      const titleMarkup = primaryLink
        ? `<a href="${escapeHtml(primaryLink.url)}"${primaryLink.external ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(project.title)}</a>`
        : escapeHtml(project.title);

      const actionMarkup = project.links.length
        ? `<div class="project-box-actions">${project.links.map((link) => `
            <a
              class="project-icon-link"
              href="${escapeHtml(link.url)}"
              ${link.external ? 'target="_blank" rel="noreferrer"' : ""}
              aria-label="${escapeHtml(link.ariaLabel || link.label)}"
            >
              ${
                link.type === "github"
                  ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>`
                  : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>`
              }
            </a>`).join("")}
          </div>`
        : "";

      const tagsMarkup = project.tags
        .map((tag) => `<li>${escapeHtml(tag)}</li>`)
        .join("");

      const evidenceMarkup = project.evidence
        .map(
          (point) =>
            `<p><strong>${escapeHtml(point.heading)}:</strong> ${escapeHtml(point.detail)}</p>`
        )
        .join("\n                ");

      const notesLinkMarkup = project.links
        .map((link) => `<a href="${escapeHtml(link.url)}"${link.external ? ' target="_blank" rel="noreferrer"' : ""}>${
          link.type === "github" ? "View source on GitHub" : escapeHtml(link.label)
        }</a>`)
        .join("\n                  ");

      const headerContent = [
        `                <div class="project-box-title-group">`,
        `                  <h3 class="project-box-title">${titleMarkup}</h3>`,
        `                </div>`,
        actionMarkup ? `                ${actionMarkup}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const notesContent = [
        `                  ${evidenceMarkup}`,
        notesLinkMarkup ? `                  ${notesLinkMarkup}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const bodyParts = [
        `              <div class="project-box-header">\n${headerContent}\n              </div>`,
        `              <p class="project-box-type">${escapeHtml(project.category)}</p>`,
        `              <p class="project-box-summary">${escapeHtml(project.summary)}</p>`,
        `              <ul class="project-box-tags" aria-label="Technologies">\n                ${tagsMarkup}\n              </ul>`,
        previewMarkup,
        `              <details class="project-notes">\n                <summary>\n                  <span>Notes</span>\n                  <svg class="plus-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>\n                </summary>\n                <div class="notes-body">\n${notesContent}\n                </div>\n              </details>`,
      ].filter(Boolean);

      return `          <div class="project-card-animate" data-card-index="${index}" data-direction="${direction}">
            <article class="project-box project-target" data-project="${escapeHtml(project.id)}">
              <div class="project-box-inner${previewImage ? " has-preview" : ""}">
${bodyParts.join("\n")}
              </div>
            </article>
          </div>`;
    })
    .join("\n\n");
}

async function updateIndexHtml() {
  const indexPath = new URL("../index.html", import.meta.url).pathname;
  let html = await fs.readFile(indexPath, "utf-8");

  const startMarker = "<!-- PROJECTS_START -->";
  const endMarker = "<!-- PROJECTS_END -->";

  if (!html.includes(startMarker) || !html.includes(endMarker)) {
    // If markers not yet present, find <div class="projects-list">...</div>
    const regex = /<div class="projects-list"[\s\S]*?<\/div>/;
    const replacement = `<div id="projects-root" class="projects-list">\n${startMarker}\n${renderProjectsHtml()}\n${endMarker}\n        </div>`;
    html = html.replace(regex, replacement);
  } else {
    const startIndex = html.indexOf(startMarker) + startMarker.length;
    const endIndex = html.indexOf(endMarker);
    html = html.slice(0, startIndex) + "\n" + renderProjectsHtml() + "\n          " + html.slice(endIndex);
  }

  await fs.writeFile(indexPath, html, "utf-8");
  console.log("Updated index.html with static projects output.");
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  updateIndexHtml().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
