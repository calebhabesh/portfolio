import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { installVignetteMask } from "./vignette-mask";
import { BackgroundRippleEffect } from "./components/ui/background-ripple-effect";

const host = document.createElement("div");
host.id = "ripple-background";
host.setAttribute("aria-hidden", "true");
document.body.prepend(host);
const disposeVignetteMask = installVignetteMask(host);

function RippleBackground() {
  const measure = () => ({ cols: Math.ceil(innerWidth / 56), rows: Math.ceil(innerHeight / 56) });
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => setSize(measure());
    const ripple = (event: MouseEvent) => {
      if (motion.matches || event.detail === 0 || !(event.target instanceof Element)) return;
      if (event.target.closest("#ripple-background, a, button, summary, .project-box, .hero-copy, .emblem-stage")) return;
      const col = Math.floor(event.clientX / 56);
      const row = Math.floor(event.clientY / 56);
      (host.querySelectorAll<HTMLElement>(".cell")[row * size.cols + col])?.click();
    };
    window.addEventListener("resize", resize);
    document.addEventListener("click", ripple);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("click", ripple);
    };
  }, [size.cols]);
  return <BackgroundRippleEffect {...size} cellSize={56} />;
}

const root = createRoot(host);
root.render(<RippleBackground />);
if (import.meta.hot) import.meta.hot.dispose(() => { disposeVignetteMask(); root.unmount(); host.remove(); });
