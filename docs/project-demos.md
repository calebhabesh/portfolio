# Project demo links

Compact cards always show three actions, in this order:

- **Live Demo** (`type: "live-demo"`) or **Live Site** (`type: "live"`) for a production application.
- **GitHub** (`type: "github"`).
- **Expand** for project details.

Missing destinations render as disabled buttons labeled “coming soon.” To
activate one, add its URL to that project's `links` in `src/data/projects.ts`.
A production site takes precedence over an interactive demo in the first slot.
Recorded demonstrations use `type: "demo"` and remain available in the expanded
view without occupying the interactive-demo slot.

Use two distinct destinations for a project with a recorded demonstration:

- **View Source** → the repository root.
- **Watch Demo** → the same repository's `#demo` README section.

GitHub scrolls to headings automatically. Give each project README a stable
`## Demo` heading near the top; use subheadings when it has several videos.
For the capstone, the public destinations are:

| Destination | URL |
|---|---|
| Source | https://github.com/calebhabesh/NM03-Capstone-Project |
| Both videos | https://github.com/calebhabesh/NM03-Capstone-Project#demo |
| Terminal comparison | https://github.com/calebhabesh/NM03-Capstone-Project#performance-comparison |
| MRI stages | https://github.com/calebhabesh/NM03-Capstone-Project#mri-stage-walkthrough |

## Publishing a video

1. Keep the short H.264 MP4, poster, WebVTT captions, and transcript in the
   project repository's `docs/assets/` directory. Keep capture methods and
   provenance nearby when timing or scientific results matter.
2. Upload the video through GitHub's Markdown editor and place its attachment
   URL on its own line under `## Demo`. This produces a native GitHub player.
   A normal repository MP4 link remains useful as the source/download fallback;
   ordinary `<video>` HTML is stripped from GitHub Markdown.
3. Record the attachment URL and the committed MP4's SHA-256 together. Verify
   playback while signed out, and never commit temporary signed playback URLs.
4. Add a `type: "demo"` link in `src/data/projects.ts`, with `external: true`
   and the repository URL ending in `#demo`. Keep `type: "github"` for source
   and `type: "live"` for a production site. Use `type: "live-demo"` for an
   interactive preview.
5. When a portfolio case study offers captioned playback, serve identical
   copies from `public/projects/<project>/`. Copy captions and posters together
   with the MP4 and verify their hashes against the source repository.

The capstone's captioned player remains at
`/projects/medical-imaging.html`; the expanded view's Watch Demo action goes
directly to the repository's two videos. The README also retains captions and transcripts.
This convention can be reused when another project's video is ready. Do not add
a Watch Demo destination until its target section and video exist.

Large or frequently replaced videos can use dedicated video hosting, with the
same stable README section linking to playback. Keep the repository's public
entry point stable when replacing the video or changing its host.

GitHub references: [section links](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#section-links),
[supported media and upload limits](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files),
and [CLI video attachments](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli#embedding-a-video).
