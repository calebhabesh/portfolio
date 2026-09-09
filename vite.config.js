import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: "es2022",
    sourcemap: false,
    // Three.js is isolated in a lazy hero-only chunk; its compressed transfer is about 162 KB.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
