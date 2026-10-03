import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import LogoLoop from "./components/LogoLoop";
import { technologyLogos } from "./data/technology-logos";

const logos = technologyLogos.map(logo => ({
  src: `/technologies/${logo.file}`,
  alt: logo.name,
  title: logo.name,
}));

function TechnologyLoop() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => setReducedMotion(motion.matches);
    motion.addEventListener("change", onMotionChange);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(container);
    return () => {
      motion.removeEventListener("change", onMotionChange);
      observer.disconnect();
    };
  }, []);

  const stopped = reducedMotion || !inView;
  return (
    <div className="technology-loop-control">
      <LogoLoop
        logos={logos}
        speed={stopped ? 0 : 18}
        logoHeight={36}
        style={{ "--logoloop-logoHeight": "calc(var(--grid-unit) * var(--technology-logo-scale, 0.7))" }}
        gap={28}
        pauseOnHover={false}
        draggable
        ariaLabel="Technologies used in my projects. Drag or use the left and right arrow keys to browse."
      />
    </div>
  );
}

const container = document.getElementById("technology-loop-root");
const root = container ? createRoot(container) : undefined;
root?.render(<TechnologyLoop />);
if (import.meta.hot) import.meta.hot.dispose(() => root?.unmount());
