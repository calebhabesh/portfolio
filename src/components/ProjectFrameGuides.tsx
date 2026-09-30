import React from "react";
import crossA from "../assets/blueprint-cross-a.svg?raw";
import crossB from "../assets/blueprint-cross-b.svg?raw";
import crossC from "../assets/blueprint-cross-c.svg?raw";
import crossD from "../assets/blueprint-cross-d.svg?raw";

// Keep the portrait's pencil artwork, splitting its straight-line subpaths
// into independent strokes so each cross draws vertically, then horizontally.
function pencilStrokes(svg: string) {
  return [...svg.matchAll(/<path d="([^"]+)" stroke-width="([^"]+)"(?: opacity="([^"]+)")?\/>/g)]
    .flatMap(([, path, width, opacity]) => (path.match(/M[^M]+/g) || []).map(d => {
      const coordinates = (d.match(/-?\d*\.?\d+/g) || []).map(Number);
      const dx = Math.abs(coordinates[coordinates.length - 2] - coordinates[0]);
      const dy = Math.abs(coordinates[coordinates.length - 1] - coordinates[1]);
      return { d, width: Number(width), opacity: Number(opacity || 1), axis: dx > dy ? "horizontal" : "vertical" };
    }));
}

const crosses = Object.fromEntries(
  Object.entries({ a: crossA, b: crossB, c: crossC, d: crossD }).map(([variant, svg]) =>
    [variant, pencilStrokes(svg)],
  ),
);
const positions = ["top-left", "top-right", "bottom-right", "bottom-left"];

function crossVariants(projectId: string) {
  // A seeded shuffle stays identical in static HTML, hydration, and rerenders.
  let seed = 2166136261;
  for (const char of projectId) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const variants = ["a", "b", "c", "d"];
  for (let i = variants.length - 1; i > 0; i--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const j = (seed >>> 0) % (i + 1);
    [variants[i], variants[j]] = [variants[j], variants[i]];
  }
  return variants;
}

export function ProjectFrameGuides({ projectId }: { projectId: string }) {
  const variants = crossVariants(projectId);
  return (
    <span className="project-frame-guides" aria-hidden="true">
      <svg className="project-frame-outline" width="100%" height="100%" fill="none">
        <rect width="100%" height="100%" pathLength="1" />
      </svg>
      {positions.map((position, index) => (
        <span
          key={position}
          className={`project-frame-corner project-frame-corner--${position}`}
          data-cross-variant={variants[index]}
        >
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            {crosses[variants[index]].map((stroke, strokeIndex) => (
              <path
                key={strokeIndex}
                d={stroke.d}
                strokeWidth={stroke.width}
                opacity={stroke.opacity}
                pathLength="1"
                className={`project-cross-stroke--${stroke.axis}`}
              />
            ))}
          </svg>
        </span>
      ))}
    </span>
  );
}
