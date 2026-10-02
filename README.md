# Caleb Habesh portfolio

My personal portfolio, with searchable project technologies, image galleries, and an
interactive 3D lion emblem. The site supports light and dark themes, keyboard
navigation, and reduced motion.

[Visit the portfolio](https://calebhabesh.com/)

- UI: React with TypeScript and JavaScript
- Build: Vite
- Styling: Tailwind CSS and custom CSS
- Graphics and animation: Three.js and Motion

## Directory overview

- `src/`: application code, styles, background effects, and the 3D scene.
- `src/components/`: React components for project cards, galleries, dialogs, and other UI.
- `src/data/`: project descriptions, image lists, and links.
- `src/assets/`: graphics, packed emblem assets, and baked textures bundled by Vite.
- `src/hooks/` and `src/lib/`: shared React hooks and utilities.
- `public/`: project images, icons, and other static files served directly.
- `models/emblem/`: Blender source files, GLB exports, and the generated collision field.
- `scripts/`: asset generators, verification checks, and screenshot tools.
- `docs/`: development notes, the design brief, and third-party notices.

`index.html` contains the page shell and generated project markup for visitors without JavaScript.

## Run locally

Use Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## Build

```bash
npm run build
npm run preview
```

The build generates a static site in `dist/`. Preview it at <http://localhost:4173>.

See [development notes](docs/development.md) for checks and the model workflow.

See [VPS deployment](docs/deployment.md) for hosting, Cloudflare setup, updates, and rollback.

[MIT license](LICENSE) · [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
