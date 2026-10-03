# Development

## Commands

- `npm run dev`: start Vite at <http://localhost:5173>, with LAN access.
- `npm run build`: regenerate assets and build the static site into `dist/`.
- `npm run preview`: serve `dist/` at <http://localhost:4173>. Rebuild to include source changes.
- `npm run test:smoke`: check the production build across desktop and mobile layouts, keyboard navigation, and reduced motion.
- `npm run test:search`: check technology matching, badge highlights, filtering, keyboard controls, and grid alignment.
- `npm run test:footer-signature`: check recorded handwriting, scroll playback, theme colors, responsive placement, and static fallbacks.
- `npm run check`: build and run the full verification suite.

Browser checks use system Chromium (`/usr/bin/chromium` by default). Set `CHROMIUM_PATH`
to use another installation. Screenshots go to the ignored `.artifacts/` directory.

## Project content

Edit `src/data/projects.ts` and put project images in `public/projects/`.
`npm run generate:projects` updates the static project markup in `index.html` for
visitors without JavaScript; production builds run it automatically.

Project search uses only `tags` and `additionalTags`. Comma-separated terms must
all match the same project. Matching additional tags appear temporarily on the
collapsed card; clearing search restores the original badges. Common aliases and
small typos are handled by `src/lib/technology-search.ts`. Matching starts with
the first character: prefixes such as `J` and `Ja` match `Java`. Short names and
aliases such as `C`, `Go`, `TS`, `JS`, and `SQL` require exact matches.
Matched text uses bold accent color
with an outlined badge. Search never indexes titles, summaries, or notes.

Search fills the existing frame slots from the top and fades only their contents.
The grid reserves room for later projects in earlier slots, keeping the crosses,
outlines, document height, and running A* maze stable while filtering. Starting a
search settles all remaining scroll entrances; clearing it keeps them settled.
Empty results show a short retry suggestion and a GitHub link in the center of
the first frame. The link changes color, animates its underline, and shifts its
arrow on hover or keyboard focus.
Unused frame outlines and crosses fade to 12% opacity while searching and return
to full strength when matching again. Their space stays reserved so filtering
does not move the page or restart the maze, and their drawing animation does
not replay with each search edit.
Filtered cards use the same expansion and collapse animations as the default
list, including the title, category, and preview image transitions.
Expanded summaries and project notes emphasize mentions of matching technologies,
including aliases and typo-corrected matches. This does not change which projects
the technology-only search returns.

See [project demo links](project-demos.md) for README anchors, video publishing,
and the distinction between source, recorded demos, and live applications.

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
