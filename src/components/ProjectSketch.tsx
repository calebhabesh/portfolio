import React from "react";

// Small pen drawings: irregular contours and a faint second pass keep
// the sketch character in the outlines themselves.
const sketches: Record<string, { outline: string; detail: string; weight?: number }> = {
  "portfolio-site": {
    outline: "M6.4 7.8Q20 7.1 33.6 7.7L34 31.8Q20.2 32.5 6 31.9Z",
    detail: "M6.3 13.4L33.7 13.1 M10.3 10.5L10.8 10.4 M14 10.4L14.5 10.5 M17.7 10.4L18.2 10.3 M11 18.3L18.1 18.1L18.3 27.2L10.8 27.4Z M22 18.4L29.2 18.2 M22.1 22L29 22.2 M22 25.8L27 25.6",
  },
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
  "systemc-noc": {
    // Sixteen routers and their mesh links echo the simulator's 4×4 topology.
    outline: "M5.7 5.6L10.2 5.4L10.4 10L5.5 10.2Z M13.7 5.5L18.3 5.7L18.1 10.3L13.5 10.1Z M21.6 5.7L26.3 5.5L26.1 10.2L21.5 10Z M29.6 5.5L34.3 5.8L34.1 10.3L29.4 10.1Z M5.5 13.6L10.1 13.4L10.3 18.1L5.7 18.3Z M13.6 13.5L18.2 13.7L18.3 18.2L13.5 18.1Z M21.7 13.6L26.1 13.4L26.3 18.3L21.5 18.1Z M29.5 13.7L34.2 13.5L34.3 18.1L29.7 18.3Z M5.7 21.5L10.3 21.7L10.1 26.2L5.5 26Z M13.5 21.7L18.3 21.5L18.1 26.1L13.7 26.3Z M21.5 21.5L26.2 21.7L26.3 26.1L21.7 26.3Z M29.7 21.6L34.1 21.4L34.3 26.2L29.5 26Z M5.5 29.7L10.1 29.5L10.3 34.3L5.7 34.1Z M13.7 29.5L18.1 29.7L18.3 34.1L13.5 34.3Z M21.7 29.7L26.3 29.5L26.1 34.3L21.5 34.1Z M29.5 29.5L34.3 29.7L34.1 34.1L29.7 34.3Z",
    detail: "M10.3 7.8L13.6 7.9 M18.2 7.9L21.6 7.8 M26.2 7.8L29.5 7.9 M10.2 15.8L13.6 15.9 M18.3 15.9L21.6 15.8 M26.2 15.8L29.6 15.9 M10.2 23.9L13.6 23.8 M18.2 23.8L21.6 23.9 M26.3 23.9L29.6 23.8 M10.2 31.9L13.6 31.8 M18.2 31.8L21.6 31.9 M26.2 31.9L29.6 31.8 M7.9 10.1L7.8 13.5 M7.8 18.2L7.9 21.6 M7.9 26.1L7.8 29.6 M15.9 10.2L15.8 13.6 M15.8 18.2L15.9 21.6 M15.9 26.2L15.8 29.6 M23.8 10.1L23.9 13.5 M23.9 18.2L23.8 21.6 M23.8 26.2L23.9 29.6 M31.9 10.2L31.8 13.6 M31.8 18.2L31.9 21.5 M31.9 26.1L31.8 29.6",
    weight: 1.2,
  },
  "fpga-pong": {
    // A VGA monitor with two paddles and a ball is recognisable at card size.
    outline: "M6.7 6.9Q20.2 6.3 33.3 7.1Q35 7.2 34.8 9L34.5 28.3Q34.4 30.1 32.6 30L7.2 30.3Q5.5 30.1 5.4 28.4L5.7 9Q5.5 7.1 6.7 6.9Z",
    detail: "M11.1 12.8L13.5 12.7L13.7 21.3L11 21.5Z M26.4 16.6L29 16.8L28.8 25.1L26.3 25Z M21.9 15.4C23.8 15.2 24 18.6 21.9 18.7C19.8 18.9 19.9 15.3 21.9 15.4Z M20.1 10.2L20 13.1 M20 20.7L20.2 23.6 M20.1 26L20 27.2 M16.7 30.2L16.1 34.7 M23.2 30.1L23.8 34.6 M12.5 35.2Q20 34.7 27.5 35.1",
    weight: 1.5,
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
