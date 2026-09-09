# Caleb Habesh — portfolio

A minimalist single-page portfolio built with Vite and Three.js. The quiet, reading-first layout
keeps the interactive lion and grass as its one expressive visual. The hero uses the optimized
vintage derivative of `lion_emblem.blend`; the original GLB and Blender source remain unchanged.

## Local development

```bash
npm install
npm run dev
```

Vite prints the local and LAN URLs. The default local URL is <http://localhost:5173>.
Because the development command binds to `0.0.0.0`, another device on the same network can use the
`Network` URL Vite prints. Press `Ctrl+C` in that terminal to stop the server.

The lion uses continuous orbit-style rotation that pauses while the pointer is held, along with
pointer-delta dragging, capped release inertia, and an underdamped spring that recoils naturally
into its upright ambient motion without a hard handoff. A fixed safety-radius pivot keeps every orientation above the grass roots. Its surrounding grass uses
instanced procedural tufts with height-weighted wind and independent, damped blade motion. Five
height probes per blade sample a precomputed union-volume signed-distance solid, with adaptive
swept substeps so quick rotations cannot skip through the grass. The collision field is generated
during the build rather than blocking the browser during startup.

## Verification

```bash
npm run build
npm run test:smoke
```

The smoke test starts the production preview, checks desktop and mobile layouts in the system
Chromium browser, waits for the 3D emblem, exercises the project notes and theme control, and
writes screenshots to the ignored `.artifacts/` directory.

## Model workflow

After editing `lion_emblem.blend`, rebuild the vintage derivative with Blender installed:

```bash
npm run weather:model
```

The site loads `lion_emblem.optimized.glb`, which uses Meshopt compression. Do not delete the
original GLB or Blender source. `scripts/weather-emblem.py` saves a separate
`lion_emblem.vintage.blend` with an editable displacement modifier and exports
`lion_emblem.vintage.glb`. Sparse shallow perimeter dents add actual silhouette wear; the
browser material adds fine granular pitting, soft tarnish, residual earth deposits, and occasional scuffs using triplanar projection on
faces, backs, bevels, and side walls. Fine wear is a browser shader, not baked into
the Blender material. Residual soil uses the same mask for brown coloration, higher
roughness, and lower metalness, without excluding the side walls. A translucent
rubbed residue carries irregular fine grains with shallow positive normal relief,
separate from the recessed corrosion pits. Flat-field vertices are excluded from displacement to avoid
long triangulation ridges resembling brushed metal. `npm run optimize:model` optimizes the vintage GLB alone.
Both model commands also regenerate `emblem-collision-field.bin`. To regenerate only that derived collision
asset, run `npm run generate:collision`.

Production builds include `public/_headers`, which gives hashed `/assets/*` files a one-year
immutable cache lifetime on hosts that support the headers file (including Cloudflare Pages).

## Content still needed before launch

- Add the final résumé PDF and its navigation link when the document is ready.
- Decide which in-development project repositories or demos should be public.
- Add a social preview image before sharing the site broadly.

Deployment and DNS are intentionally left for a later pass. The production build is static and
can be served by Cloudflare Pages, GitHub Pages, a VPS, or any ordinary static web server.
