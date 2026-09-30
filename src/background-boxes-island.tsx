import React from "react";
import { createRoot } from "react-dom/client";
import BackgroundBoxesDemo from "./components/background-boxes-demo";

const container = document.getElementById("background-boxes-root");
const root = container ? createRoot(container) : undefined;
root?.render(<BackgroundBoxesDemo />);

if (import.meta.hot) import.meta.hot.dispose(() => root?.unmount());
