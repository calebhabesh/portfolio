# Portfolio refactor brief for Gemini 3.8 Flash

Date: 2026-09-24  
Role: implementation specification; this document does not implement the site changes.

## Goal and fixed decisions

Make the current portfolio easier to read on desktop, update the five selected projects to match their repositories, and add restrained pointer interaction to project cards. Keep the existing Vite site, lion scene, background ripple, light/dark theme, and single-page purpose. The portfolio is a project case-study hub, so content and proof take precedence over decoration.

Project order is **Doorlink, LineWatchTO, File Sync, CourtLoad, Medical Imaging**. Remove RiftTrace from the active site. The final title must be **Medical Imaging** everywhere, including visible text, accessible names, and metadata if added.

Agreed decisions from the first design round:

1. Each card shows a useful two-to-three-sentence summary, with three deeper evidence points in an expandable Notes area.
2. Link only to destinations that are already public. Do not make an unpublished repository, local host, or future demo look clickable.
3. Use normal document scrolling. Remove the fixed-height inner scroll region and its floating scroll cue.
4. Scope Target Cursor to project cards. Touch, keyboard, and reduced-motion users get fully usable static cards with ordinary cursor/focus behavior.

Agreed decisions from the second design round:

5. Keep the five projects in one generous desktop column, roughly 900–960px wide.
6. Use real evidence images where suitable and safe to publish; cards without suitable imagery remain text-first.
7. Use factual badges: **Working prototype / Live / Pilot tested / Complete / Capstone**.

## Current state and why it needs change

- `index.html` owns all project markup; `src/main.js` owns theme, emblem startup, and the inner-scroll cue. React is already used in `src/ripple-background.tsx`, but the project cards are plain HTML.
- `src/styles.css` caps `.page-shell` at 680px, uses a 15px base font, sets the hero introduction to 0.84rem, card summaries to 0.72rem, Notes to 0.66rem, and the project type to 0.59rem. On a desktop screenshot, the cards occupy a narrow strip and several text roles are too small to scan.
- `body` is fixed to `100dvh` with `overflow: hidden`; `#main-content` is the scroll container; cards stretch through `grid-auto-rows: 1fr`. Richer copy will compound the awkward scrolling and equal-height whitespace.
- CourtLoad's current fantasy-week-planner summary is a legacy feature. Its active product is NBA player comparison and analytics. RiftTrace is retired by the locked blueprint and is replaced by File Sync.
- The existing dark text tokens have nominal contrast, but apparent readability suffers from very small type, subdued colors, thin weights, and the patterned backdrop. Change the type scale and colors together. Do not solve this with browser `zoom` or a single global `transform: scale()`.
- Existing local edits to `TODO.md` and `src/styles.css` predate this brief. Preserve them when implementing.

## Layout and visual specification

### Desktop

- Raise the page shell to a **900–960px max width**. Keep adaptive outer gutters of roughly 28–48px; at 1440px, the visible content should feel significantly wider than today, with the hero and cards sharing the same left/right edges.
- Keep one generous project column by default. It preserves the explicit project ranking and gives expanded evidence enough width. Limit long prose measures inside wide cards to about **65–80 characters**; do not make paragraph lines span the whole viewport.
- Increase the hero's copy column and emblem stage proportionally. Aim for a **300–340px** desktop emblem stage, with enough separation so the lion never overlaps text. Do not increase WebGL internal resolution without checking performance.
- Remove `height: 100vh/100dvh`, `overflow: hidden`, the inner `overflow-y: auto`, the main-content bottom mask, `.projects-scroll-arrow`, associated `ResizeObserver`/scroll logic, and `grid-auto-rows: 1fr`. Let content determine card height and let the page scroll normally. Keep the header and footer in document flow.
- Give cards **24–28px** padding, **18–24px** gap between cards, a visible border, and a restrained hover elevation. Do not let a transformed card overlap the next card or clip its expanded Notes.

### Type and control targets

Use a modular scale rather than uniformly multiplying CSS values. Suggested desktop starting points, to tune against the actual font rendering:

| Role | Target |
| --- | --- |
| Body / card summary | 16–17px, line-height 1.55–1.65 |
| Hero introduction | 17–18px, max-width about 58ch |
| Hero subtitle | 17–18px |
| Location and social labels | 15–16px |
| Social icons | 18–20px |
| Project title | 20–22px |
| Project type / section eyebrow | 12–14px, semibold |
| Tags and status badge | 12–14px; do not use 9px badges |
| Notes summary and expanded text | 15–16px |
| Icon/link/Notes hit area | at least 44×44px |

At narrow widths, retain comfortable 16px body copy, let titles and badges wrap, and keep 16–20px card padding. Do not force title ellipses: `Medical Imaging` and `LineWatchTO` should remain readable at 320px. Ensure the larger Amharic name can wrap cleanly beside or below the Latin name.

### Color

Keep the dark green visual identity, but use warm off-white for primary copy and a lighter neutral for secondary copy. Reserve green for short accent labels, selected states, and links. Suggested dark-mode starting tokens, each to be checked against the *composited* card/background color:

| Token | Dark proposal | Use |
| --- | --- | --- |
| Primary | `#f1eee5` | headings and important links |
| Secondary | `#d3dace` | paragraphs and Notes |
| Muted | `#b9c5b9` | locations, metadata, tags |
| Accent | `#a8dfb7` | short labels and active links |
| Page / card | existing `#111613` / `#18201b`, adjusted only if needed | surfaces |

These examples exceed 4.5:1 on the current dark card; the current 0.59–0.72rem sizes still need correction. Retain separate dark-on-light semantic values for light mode (for example primary `#161f1b`, secondary `#38423d`, muted `#57625d`, accent `#1d6141`). Never reuse the light text hex values in light mode. Measure normal text at **at least 4.5:1** and meaningful icons/borders/focus cues at **at least 3:1** in both themes. Test badges over their actual tinted background and the ripple pattern behind the hero.

### Hero copy

Replace the two repetitive introduction sentences with one concise positioning statement that fits the actual project mix. Suggested copy: **“Computer Engineering graduate in Toronto building full-stack tools, connected devices, and reliable data systems. My work spans a custom smart doorbell, transit reliability, file synchronization, and NBA analytics.”** Keep the TMU education line if desired, but avoid repeating “Computer Engineering graduate” in both the subtitle and introduction. Treat this as editorial copy to tune for voice, not as a claim of production deployment for every project.

## Project content model and exact draft copy

Store the five entries in one ordered content module rather than scattering text between HTML and JSX. Suggested fields: `id`, `title`, `category`, `status`, `summary`, `evidence[]`, `tags[]`, `media`, and `links[]`. `status` should be a factual label; it is not a quality score. The summary describes the user problem and useful outcome before the stack. Evidence points describe the technical decision and real validation. Use the following as copy-ready starting text; tighten only for actual card width, without dropping factual qualifiers.

### 1. Doorlink

**Category:** Embedded systems · self-hosted IoT  
**Status:** Working prototype  
**Summary:** “A self-hosted smart doorbell built on a hand-assembled ESP32-S3 PCB and Raspberry Pi gateway. A button press wakes the device, captures a visitor image, sends a notification, and returns to deep sleep; the dashboard also supports stored, turn-based voice replies.”

**Evidence in Notes:**

1. “Custom hardware: The Rev C board combines an OV5640 camera, microphone, speaker, battery power path, and routed KiCad design.”
2. “Device-to-dashboard flow: ESP-IDF firmware sends events to a Spring Boot gateway with PostgreSQL, MinIO media storage, MQTT, and a Next.js interface.”
3. “Validation boundary: The battery-powered capture/upload/sleep path and audio paths have run on hardware. Final hardened-firmware retest and closed-enclosure current measurements remain.”

**Suggested tags:** ESP32-S3, Spring Boot, Raspberry Pi, KiCad.  
**Public destination:** [Doorlink GitHub](https://github.com/calebhabesh/doorlink).  
**Potential real media:** `../smart-doorbell/docs/media/assembled-pcb.jpg` or `finished-enclosure.jpg`; choose one that shows the device clearly and follow its repository photo attribution/license.

Avoid “outdoor ready,” “full-duplex call,” or any battery-life number.

### 2. LineWatchTO

**Category:** Transit intelligence · full stack  
**Status:** Live  
**Summary:** “A map-first reliability dashboard for TTC and GO/UP riders. It brings service alerts, planned closures, station arrivals, and saved-commute impact checks into one view, while labeling stale, scheduled, unavailable, and demo data honestly.”

**Evidence in Notes:**

1. “Two networks: Custom TTC and GO/UP map views connect incidents and station details to the lines and stops riders care about.”
2. “Personal impact: Saved commutes and stations surface relevant disruptions, with optional notifications and offline PWA snapshots.”
3. “Freshness rules: Java/Spring ingestion, PostGIS, and Redis support source-linked alerts; stale upstream data is not shown as current.”

**Suggested tags:** Next.js, Spring Boot, PostGIS, Redis.  
**Public destination:** [Live site](https://linewatchto.ca). Its GitHub repository did not resolve publicly during this audit, so omit a source icon until visibility changes.  
**Potential real media:** `../linewatchto/frontend/public/assets/linewatch/onboarding/desktop-map-guide.png` or a fresh screenshot of the live site, with actual demo/source labels visible.

Avoid implying cross-network routing or live vehicle positions from estimated markers.

### 3. File Sync

**Category:** Distributed systems · local-first files  
**Status:** Pilot tested  
**Summary:** “A Go peer-to-peer file sync daemon for trusted Linux devices. It keeps causal version history, transfers content-addressed chunks over authenticated peer connections, and exposes concurrent edits for deliberate resolution through a local interface instead of silently replacing a file.”

**Evidence in Notes:**

1. “Causal history: Immutable version heads and vector clocks preserve offline edits; the local UI lets users inspect history and conflicts.”
2. “Recovery: SQLite metadata, atomic chunk staging, and fault-injection tests exercise crash durability.”
3. “Real workflow: A workstation, Raspberry Pi, and cloud relay were used in a three-host pilot; the repository also has a local multi-process demo.”

**Suggested tags:** Go, SQLite, mTLS, Linux.  
**Public destination:** none currently verified. The `calebhabesh/file-sync` GitHub URL returned 404 without authentication during this audit; do not render it as a public link.  
**Potential real media:** `../file-sync/docs/evidence/p14-20260923/screenshots/screenshot-04-files-history.png` or `screenshot-06-conflicts-view.png`; inspect for personal paths, device IDs, and tokens before publishing.

The latest README and some evidence are uncommitted locally. Do not publish numerical wire-saving or failure-count claims until the evidence is committed, reviewed, and public. Do not call this a consensus system or distributed database.

### 4. CourtLoad

**Category:** NBA analytics · data engineering  
**Status:** Complete  
**Summary:** “An NBA player comparison and analytics dashboard built from three historical regular seasons. It lets users compare player form, usage, and matchup context with source-traceable data and uncertainty informed by time-safe evaluation.”

**Evidence in Notes:**

1. “Reproducible data: Python ingestion, PostgreSQL, and tested dbt models turn pinned schedules and box scores into dated player and opponent views.”
2. “Useful comparison: A Next.js dashboard and FastAPI service show side-by-side trends, game logs, and matchup context.”
3. “Honest modeling: Out-of-time evaluation kept the EWMA baseline after a gradient-boosted challenger failed promotion gates; the evaluation is shown to users.”

**Suggested tags:** Python, PostgreSQL, dbt, Next.js.  
**Public destination:** none currently verified. The `calebhabesh/courtload` GitHub URL returned 404 without authentication during this audit; do not render it as a public link.  
**Potential real media:** `../nba-analytics/docs/assets/real-comparison.png`; the repository also contains a 25-second demo video.

Remove the current fantasy-week-planner summary and “Verified” badge. Fantasy planning is legacy/fixture functionality and should not define this card. Avoid implying that the rejected challenger powers predictions.

### 5. Medical Imaging

**Category:** Parallel computing · team capstone  
**Status:** Capstone  
**Summary:** “A C++ medical-imaging pipeline for processing DICOM brain scans with FAST and OpenMP. The team batched image work across CPU threads and compared sequential and parallel execution through performance analysis.”

**Evidence in Notes:**

1. “Pipeline: DICOM ingest, preprocessing, segmentation, morphological operations, and export were integrated with FAST.”
2. “Parallel design: OpenMP distributes scan batches across CPU threads.”
3. “Evaluation: Benchmark tooling compares execution modes; present a numerical speedup only if the result and personal contribution can be cited.”

**Suggested tags:** C++17, OpenMP, FAST, DICOM.  
**Public destination:** [Capstone GitHub](https://github.com/calebhabesh/NM03-Capstone-Project).  
**Media:** a genuine pipeline output or architecture image if its reuse rights and medical-data handling are clear; otherwise use a text-first card.

The wording must credit the team. Do not imply clinical validation or a diagnostic product.

## React Bits + Aceternity integration

**Feasibility: yes, with a small integration layer.** [React Bits Target Cursor](https://www.reactbits.dev/animations/target-cursor) locks four corners onto an element matching `targetSelector`. [Aceternity Comet Card](https://ui.aceternity.com/components/comet-card) rotates/translates a child on pointer movement. A stationary outer `.project-target` wrapper can be the cursor target while Comet tilts the inner visual surface. This prevents the target box from moving under the cursor and creating feedback/jitter. The cursor and card must not own click behavior; links and `<details><summary>` remain real HTML controls.

The requested install commands are valid registry items:

```bash
npx shadcn@latest add @react-bits/TargetCursor-JS-CSS
npx shadcn@latest add @aceternity/comet-card-demo
```

The second command installs the sample invitation UI **and** the base Comet Card dependency. Inspect the sample, then use `CometCard` around the real project-card content and remove the unused demo component. The [base item](https://ui.aceternity.com/components/comet-card) can also be installed directly with `npx shadcn@latest add @aceternity/comet-card`. Use `npx shadcn@latest view ...` or `--dry-run` first to inspect file paths and dependencies; the CLI supports these modes in its [documentation](https://ui.shadcn.com/docs/cli).

The current repository is **Vite + vanilla HTML/JS with React only for a background island**, not a configured shadcn project. Before running `add`, set up `components.json`, an `@` → `src` Vite alias, a compatible JSX/TSX path, and any required `@/lib/utils` helper. Follow the [existing-Vite setup](https://ui.shadcn.com/docs/installation/vite), but inspect generated changes because the site has existing theme tokens and Tailwind v4 CSS. Do not overwrite `src/styles.css` or replace the existing design system. The Target Cursor registry item adds GSAP; Comet Card uses `motion/react` and a utility class helper. Keep the mixed JS/CSS and TSX component files if Vite builds them cleanly, or convert the copied Comet file to JSX consistently after installation.

Suggested React boundary: move only the project list into a `Projects` React island with one data source and a `ProjectCard` component. Keep the hero's existing imperative Three.js stage and the background ripple isolated. The project content must still be visible when JS is unavailable: either prerender the React card markup into the static Vite output and hydrate it, or provide a complete, current static fallback generated from the same content module. Avoid a hand-maintained second copy of project descriptions. Retain semantic `<section>`, `<article>`, headings, links, and `<details>`; never place a `<button>` around the whole card because there are nested actions.

Interaction behavior to implement in the copied components:

- Mount one Target Cursor instance, portal it to `document.body`, and set `targetSelector=".project-target"`. Keep the browser pointer visible on the rest of the site: `hideDefaultCursor={false}` plus a small component adaptation so the target cursor itself is hidden outside card hover. The upstream default hides the body's cursor globally and displays a viewport-wide spinning cursor; that is broader than the agreed card scope.
- Apply `.project-target` to the **stable, untransformed** outer card wrapper. Put Comet Card only on the inner surface. Do not use nested `.project-target` elements for links or tags.
- Reduce Comet intensity from its demo defaults (`rotateDepth=17.5`, `translateDepth=20`, `scale=1.05`, bright glare, heavy shadow). Start around **3–5°**, **3–6px** translation, and **1.00–1.015** scale. Tone down the glare and shadow so the text remains crisp and the card does not collide with adjacent cards. The demo's invitation button/image should not be copied into project cards.
- Recompute target bounds when Notes open, cards resize, or the page scrolls; use `ResizeObserver` or a fresh `getBoundingClientRect()` during active hover. The supplied Target Cursor measures a target on entry, so an expanded card otherwise leaves the corners in the old position.
- On touch/pen, hoverless pointers, and `prefers-reduced-motion: reduce`, disable both cursor following and card tilt/glare. Keep a steady border/focus treatment. On keyboard focus, do not transform the card; use a clear `:focus-within` ring or border. The existing lion canvas remains separately draggable.
- Audit event listeners and animation cleanup on React unmount/HMR. Do not have the cursor capture clicks (`pointer-events: none`). Verify the transformed card's stacking context does not cover neighboring links or the footer.
- Preserve `<details>` keyboard behavior, `aria-label`s on icon links, color-independent live status, and normal text selection. Hover never gates content or navigation.

## Implementation sequence for Gemini

1. Preserve the current working-tree edits. Create a small implementation branch/worktree if that helps isolate the change.
2. Extract an ordered project content module with the approved five entries. Correct meta description if it still implies obsolete work. Add only verified public links; make all other card titles plain text rather than faux links.
3. Refactor page flow and typography before adding effects. Validate desktop width, wrapping, 320px mobile, light/dark contrast, and normal page scrolling with static cards first.
4. Configure shadcn registry prerequisites in this Vite app. Install both requested items, inspect generated code, and remove the unused Comet demo. Record the sources and required notices in `THIRD_PARTY_NOTICES.md`.
5. Build the project React island and static/no-JS output path. Add subtle Comet surfaces and stable Target Cursor wrappers. Preserve real links, Notes controls, and clear focus states.
6. Add selected real project media if approved and safe to publish. Resize/compress copies in `public/`; keep source originals in their project repositories. Use meaningful alt text, lazy load below-the-fold media, fixed aspect ratio, and responsive dimensions. Do not use a generic stock invitation image.
7. Update `scripts/smoke.mjs` assertions for the five names/order, public links, Notes toggles, theme, horizontal overflow, and JavaScript errors. Add focused checks for reduced motion/touch and keyboard focus because those are the risks introduced by the new components. Update README text describing the site.
8. Run `npm run check`, compare 320px/390px/768px/1440px screenshots in both themes, and inspect the first paint and card interaction manually. Check that opening Notes does not misplace the cursor corners and that the 3D hero remains smooth.

## Acceptance criteria

- The desktop content width and all text/control roles are visibly larger; body and project summaries are readable without zooming. Mobile has no horizontal overflow or truncated title.
- The visible card order and content match this brief, with RiftTrace absent and “Medical Imaging” title-cased.
- CourtLoad describes NBA player comparison, File Sync describes causal synchronization, and no unpublished metrics or inaccessible source links appear.
- All normal-size text meets 4.5:1 contrast on its actual rendered surface in both themes; meaningful icons and focus cues meet 3:1.
- Cards remain usable with mouse, keyboard, touch, JS disabled, and reduced motion. Notes open/close without layout overlap, trapped focus, or lost text selection.
- Target Cursor appears only for supported pointer hover over stable project-card wrappers; Comet tilt is subtle and does not degrade scanning. They work together without target jitter.
- No existing user edits are overwritten; the lion, background ripple, theme switch, and public LineWatchTO link still work.

## Evidence and source locations

- Portfolio: `index.html`, `src/styles.css`, `src/main.js`, `src/ripple-background.tsx`, `scripts/smoke.mjs`, `README.md`.
- Locked strategy: `../Caleb_Optimized_Portfolio_Project_Blueprint_v2.md`, especially “Executive Strategy — Locked Portfolio,” “Portfolio Reality Standard,” and “Project 0: Portfolio Site.” The blueprint's Next.js recommendation is aspirational; this brief keeps the existing Vite stack because these card effects do not require a framework migration.
- Project status: `../smart-doorbell/README.md`, `../linewatchto/README.md`, `../file-sync/README.md`, `../nba-analytics/README.md`, `../capstone/README.md`. Recheck these immediately before publishing copy because the projects are actively changing.
- Registry references: [React Bits project and install model](https://github.com/DavidHDev/react-bits), [Aceternity Comet Card](https://ui.aceternity.com/components/comet-card), [shadcn registry namespaces](https://ui.shadcn.com/docs/registry/namespace), and [Vite installation](https://ui.shadcn.com/docs/installation/vite).
