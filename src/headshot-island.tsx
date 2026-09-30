import React from "react";
import { hydrateRoot } from "react-dom/client";
import { DirectionAwareHover } from "./components/ui/direction-aware-hover";

const container = document.getElementById("headshot-root");
const root = container ? hydrateRoot(container, (
  <DirectionAwareHover
    imageUrl="/caleb-headshot.jpg"
    alt="Caleb Habesh"
    className="hero-headshot"
  />
)) : undefined;

if (import.meta.hot) {
  import.meta.hot.dispose(() => root?.unmount());
}
