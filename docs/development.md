# Development

## Commands

- `npm run dev`: start Vite at <http://localhost:5173>, with LAN access.
- `npm run build`: regenerate assets and build the static site into `dist/`.
- `npm run preview`: serve `dist/` at <http://localhost:4173>. Rebuild to include source changes.
- `npm run test:smoke`: check the production build across desktop and mobile layouts, keyboard navigation, and reduced motion.
- `npm run check`: build and run the full verification suite.

Browser checks use system Chromium (`/usr/bin/chromium` by default). Set `CHROMIUM_PATH`
to use another installation. Screenshots go to the ignored `.artifacts/` directory.

## Project content

Edit `src/data/projects.ts` and put project images in `public/projects/`.
`npm run generate:projects` updates the static project markup in `index.html` for
visitors without JavaScript; production builds run it automatically.

## Emblem assets

`models/emblem/` contains the original Blender project and GLB, the Blender backup,
the vintage derivatives, the optimized GLB, and the generated collision field.
The browser uses packed assets and baked textures from `src/assets/`.

After editing `models/emblem/lion_emblem.blend`, run:

```bash
npm run weather:model
npm run generate:textures
```

The weathering step requires Blender and saves separate vintage files. It preserves
the original model. Optimization uses Meshopt compression and regenerates the
collision field and packed browser assets.

To regenerate individual assets:

- `npm run optimize:model`: optimize the vintage GLB and regenerate collision and packed assets.
- `npm run generate:collision`: rebuild the collision field from the optimized model.
- `npm run pack:emblem`: gzip the optimized model and collision field into `src/assets/`.
- `npm run generate:textures`: bake the procedural surface maps into WebP textures.

Production builds run collision generation, packing, and texture generation automatically.
Keep the generated files in `src/assets/` in version control so development works immediately.

The original model generator is `scripts/generate-emblem.py`. It requires Blender
and the external SVG specified by its `svg_path` argument; outputs go to `models/emblem/`.

## Notes

If the emblem's rotation hitches in Chrome, compare with the Simplify extension disabled.
A previous hitch disappeared with that extension disabled and did not reproduce in Firefox.

See [the project checklist](TODO.md) for outstanding content tasks.
