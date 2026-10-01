import React from "react";

// Small pen drawings: irregular contours and a faint second pass keep
// the sketch character in the outlines themselves.
const sketches: Record<string, { outline: string; detail: string; weight?: number }> = {
  doorlink: {
    outline: "M13.2 9.3Q20 8.1 27 9L27.6 31.9Q20.4 32.8 12.8 31.7Z",
    detail: "M20.1 17.2C25.8 16.1 25.7 24.5 20.3 24.4C15.2 24.9 14.8 17.7 20.1 17.2Z M16.4 12.4L23.7 12.1 M18 28.3L22 28.5 M8.5 13.1Q4.9 19.5 8.7 25.2 M4.7 10.2C1.5 14.4 1.1 23.2 4.9 28.3 M31.3 12.6Q35.5 19.1 31.8 25.5 M35.3 9.8C39 14.4 39.4 23.5 35.6 28.8",
  },
  linewatch: {
    outline: "M12.1 6.5Q20 4.8 28.8 6.2Q31.6 6.8 31.5 10.2L31.9 26.8Q31.4 30.5 27.4 31L12 31.3Q8.2 30.8 8.3 26.9L8 10.7Q7.9 7.4 12.1 6.5Z",
    detail: "M12.2 11.2L18.1 10.9L18.3 19.2L12.1 19.5Z M21.8 11.1L27.8 11.2L28.1 19.3L21.7 19.5Z M15.7 8.3L24 8.1 M12.9 23.3L15.1 23.4 M25 23.2L27.2 23.4 M14 27.5L26.2 27.3 M13 31.2L9 36 M26.7 31L30.7 35.8 M11.1 34L28.6 34.2",
    weight: 1.65,
  },
  "file-sync": {
    outline: "M8.5 13.8L18.6 13.2L25.7 19.7L25.1 32.3L8 32.7Z",
    detail: "M18.6 13.2L18.4 20.2L25.7 19.7 M13.2 10.4L24.2 7.1L31.5 12.6L33.1 27.5L28.4 28.5 M24.2 7.1L25.3 14.3L31.5 12.6 M12.3 24.2L20.3 23.8 M12.2 27.5L18.5 27.6",
  },
  courtload: {
    outline: "M20 5.6C28.1 5.4 34.5 11.9 34.3 20.2C34.8 28.3 28.2 34.6 20.1 34.2C12 34.8 5.3 28.1 5.6 20C5.4 11.9 11.8 5.5 20 5.6Z",
    detail: "M20.1 5.8Q19.5 19.8 20.2 34.2 M5.8 20.1Q20.4 19.6 34.2 20.2 M11.1 8.8C19.4 14.2 19.5 25.4 11.2 31.2 M28.8 8.8C20.7 14.1 20.7 26.1 28.8 31.1",
    weight: 1.65,
  },
  "medical-imaging": {
    outline: "M16.2 10.7L24 10.4L24.2 16.3L30 16.1L30.3 23.9L24 24.1L24.2 30L16.3 30.2L16.1 24.2L10 24.4L9.8 16.4L16 16.2Z",
    detail: "M5.8 12L5.4 5.7L12.3 5.3 M27.8 5.5L34.8 5.9L35.1 12.8 M35 27.7L34.6 34.9L27.7 35.2 M12.6 35L5.6 34.6L5.3 27.8",
    weight: 1.65,
  },
};

export function ProjectSketch({ projectId }: { projectId: string }) {
  const sketch = sketches[projectId];
  if (!sketch) return null;

  return (
    <svg className="project-sketch" viewBox="0 0 40 40" fill="none" stroke="currentColor"
      strokeWidth={sketch.weight || 1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <g transform="rotate(-5 20 20)">
        <path d={sketch.outline} />
        <path d={sketch.outline} strokeWidth="0.65" opacity="0.35" transform="translate(0.55 -0.4)" />
        <path d={sketch.detail} />
      </g>
    </svg>
  );
}
