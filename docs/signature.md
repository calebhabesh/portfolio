# Signature capture

Start the recorder with `npm run signature`, then visit
<http://localhost:5174/tools/signature-recorder/>. With the normal development server,
the same tool is available at <http://localhost:5173/tools/signature-recorder/>.

1. Connect the Wacom and draw a few natural strokes. The input indicator should say
   `pen`; the pressure indicator reports a range when pressure values vary.
   A tablet configured to emulate a mouse still draws, but won't supply pen pressure.
2. Clear the test strokes, then sign normally. Lift the pen between strokes and
   include your usual underline or flourish. Try three to five takes.
3. Replay with original timing, or fit the entire recording into two or three seconds.
   This changes preview playback only; exported JSON retains the original timing.
4. Check the footer preview in light and dark colors. Adjust ink weight or turn off
   pressure styling without changing the recorded points.
5. Download **both JSON and SVG** before clearing a favourite take. Browser downloads
   normally go to your Downloads folder. Filenames include the download time.
6. Load saved JSON to revisit a take. Bring the chosen recording back for footer integration.

The draft is saved in localStorage for this browser and origin. A different port or
browser has a different draft. It is a convenience, not a replacement for downloads.
The recorder sends no signature data to a server. It uses native Pointer Events with
coalesced samples when supported; no drawing library is installed. Pressure rendering
uses recorded pressure only for pen input, with constant width for mouse and touch.

The studio lives under `tools/` and is served by Vite in development. It is not a
production entry point and is not copied into `dist/`.

## Footer animation

The selected take is stored in `src/assets/signature/caleb.json` and `caleb.svg`,
copied from the original `signature-26-10-3` exports. The originals are preserved.
`src/footer-signature.js` sequences native SVG stroke animations from its recorded
timestamps, including its two pen strokes and pressure-dependent ink widths. Playback
starts once when the signature enters view, after a 120 ms entrance delay, and keeps
the original approximately 1.5 second timing. It never loops or replays on scrolling.

The final SVG is a CSS mask in the footer, inheriting the site's ink color in both
themes. This also provides the finished signature without JavaScript, when optional
animation loading fails, and with reduced motion. Switching to reduced motion or
hiding the tab during playback settles the signature immediately. The email and
byline retain their original row and footer height. The signature artwork is
positioned absolutely in the gap between them, shrinking to fit narrower screens
without adding document height.

To replace the signature, download a matching JSON/SVG pair and replace both files
in `src/assets/signature/`. Run `npm run build` and `npm run test:footer-signature`.

## Recording format

`format: "caleb-signature"`, `version: 1` identifies the exported JSON. Coordinates
use a fixed 1000 × 400 drawing surface regardless of screen size or pixel density.

- `settings.width`: base ink width in drawing coordinates.
- `settings.pressure`: whether to use pen pressure when rendering.
- `strokes[].pointerType`: `pen`, `mouse`, or `touch`.
- `strokes[].startedAt` / `endedAt`: milliseconds from the first recorded pen-down.
- `strokes[].points[]`: `{ x, y, time, pressure }`; pressure ranges from 0 to 1.

Pen-up timestamps preserve pauses, including stationary holds at the end of a stroke.
Continuing a restored/imported recording or drawing after undo inserts a 180 ms gap
before the next stroke instead of counting time spent outside that recording.
Midpoint quadratic curves smooth the samples for Canvas playback and SVG export;
the JSON retains the sampled points. SVG exports crop to the artwork, include a
transparent background, and use `currentColor` so the footer can supply its ink color.
SVG alone does not retain the recording's timing.

Run `npm run test:signature` for browser checks of capture, pressure, replay, downloads,
draft restore, import validation, resizing, touch, and reduced motion.
