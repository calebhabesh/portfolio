# Third-party notices

The instanced tuft and shader-wind architecture in `src/grass-field.js` was adapted from
[FluffyGrass](https://github.com/thebenezer/FluffyGrass). The portfolio uses its own procedural
geometry, colors, and collision solver.

## FluffyGrass

MIT License

Copyright (c) 2023 Ebenezer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Aceternity UI Comet Card

`src/components/ui/comet-card.tsx` is adapted from Aceternity UI's
[Comet Card](https://ui.aceternity.com/components/comet-card) (`@aceternity/comet-card`).
The local integration reduces the tilt, translation, and glare, removes the stock scale-up and shadow, and respects reduced-motion preferences.

## Aceternity UI Expandable Card

`src/components/expandable-card-demo-standard.tsx` and `src/hooks/use-outside-click.tsx` are sourced from Aceternity UI's
[component registry](https://ui.aceternity.com/components/expandable-card) (`@aceternity/expandable-card-demo-standard`).
The local integration uses a short Motion entrance, keyboard Escape handling, and outside-click dismissal to open project details in an accessible modal dialog.

## React Bits Logo Loop

`src/components/LogoLoop.jsx` and `LogoLoop.css` were installed using
`npx shadcn@latest add @react-bits/LogoLoop-JS-CSS` from
[React Bits Logo Loop](https://reactbits.dev/animations/logo-loop).
The integration uses small muted logos, slow motion, pointer dragging and arrow-key
browsing, reduced-motion support, and suspends animation while offscreen.
Automatic motion resumes after dragging ends.

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## Technology logos

The filled GitHub icon in `index.html` is also sourced from Simple Icons (CC0).

Local technology assets in `public/technologies/` are sourced from
[Simple Icons](https://github.com/simple-icons/simple-icons) (CC0),
[Devicon](https://github.com/devicons/devicon) (MIT), and the official
PostGIS, dbt, OpenMP, FAST, DICOM, and GTFS websites. Individual source URLs
are recorded in `src/data/technology-logos.js`. Names and logos identify
the technologies used by the projects; their trademarks belong to their owners.
