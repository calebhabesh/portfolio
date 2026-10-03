# Development

## Commands

- `npm run dev`: start Vite at <http://localhost:5173>, with LAN access.
- `npm run build`: update static project markup, regenerate changed assets, and build the static site into `dist/`.
- `npm run preview`: serve `dist/` at <http://localhost:4173>. Rebuild to include source changes.
- `npm run test:smoke`: check the production build across desktop and mobile layouts, keyboard navigation, and reduced motion.
- `npm run test:search`: check technology matching, badge highlights, filtering, keyboard controls, and grid alignment.
- `npm run test:footer-signature`: check recorded handwriting, scroll playback, theme colors, responsive placement, and static fallbacks.
- `npm run check`: build and run the quick checks for routine updates.
- `npm run check:full`: build and run the complete regression suite, including physics, animation timing, and detailed layout checks.
- `npm run test:build`: check asset caching and verified-build reuse without launching a browser.

## Verification workflow

For routine text, image, and project-content changes, run `npm run check`. This
checks the build workflow and technology matching, then uses one browser and
preview server for desktop/light and mobile/dark checks. It verifies hydration,
3D scene readiness, horizontal overflow, search and empty results, dialog and
gallery controls, keyboard focus, theme switching, browser/resource errors, and
desktop accessibility. The mobile scenario also uses reduced motion.

For a feature change, add the relevant commands below after the quick check:

| Changed area | Additional checks |
| --- | --- |
| Search or filtering | `npm run test:search` |
| Cards, dialogs, or galleries | `npm run test:cards` |
| Grid, layout, or startup scrolling | `npm run test:grid` and `npm run test:scroll` |
| Pointer trail | `npm run test:trail` |
| Paper texture | `npm run test:paper` |
| Maze generation or drawing | `npm run test:maze` |
| Footer signature | `npm run test:footer-signature` |
| Signature recorder (development tool) | `npm run test:signature` |
| 3D scene or startup scheduling | `npm run test:startup` and `npm run test:smoke` |

Run `npm run check:full` for broad changes to shared styles, layout, rendering,
or startup behavior. It retains every check from the previous full suite and
prints individual runtimes. Browser and performance checks run sequentially so
resource contention does not distort timing assertions. The recorder studio
remains a separate development-tool check.

Individual browser commands use the existing `dist/`; rebuild after changing
source. Deployment reuses a build that passed `check` or `check:full` only while
both the source and the built files still match their recorded content hashes.
An unverified, stale, or missing build triggers a fresh build and quick check.

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

Production builds run collision generation, packing, texture generation, and
paper baking when their inputs or generated outputs change. The cache hashes
generator code, its local dependencies, the dependency lockfile, and output
contents; file timestamps alone cannot hide a change. Cache records live in the
ignored `.artifacts/build/` directory. A fresh checkout regenerates everything
once. Delete `.artifacts/build/` to force regeneration on the next build, or use
the individual generation commands above.
Keep the generated files in `src/assets/` in version control so development works immediately.

The original model generator is `scripts/generate-emblem.py`. It requires Blender
and the external SVG specified by its `svg_path` argument; outputs go to `models/emblem/`.

## Notes

If the emblem's rotation hitches in Chrome, compare with the Simplify extension disabled.
A previous hitch disappeared with that extension disabled and did not reproduce in Firefox.
