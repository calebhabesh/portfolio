export interface ProjectEvidence {
  heading: string;
  detail: string;
}

export interface ProjectLink {
  label: string;
  url: string;
  // A live demo is interactive; "demo" links preserve recorded walkthroughs.
  type: "live" | "live-demo" | "github" | "demo";
  ariaLabel: string;
  external?: boolean;
}

export interface ProjectImage {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
}

export interface ProjectItem {
  id: string;
  tone: "sage" | "slate" | "clay" | "ochre" | "lilac" | "teal" | "orange" | "rose";
  title: string;
  category: string;
  status: "Working prototype" | "Live" | "In development" | "Complete" | "Capstone" | "Course project";
  summary: string;
  evidence: ProjectEvidence[];
  tags: string[];
  additionalTags?: string[];
  links: ProjectLink[];
  images?: ProjectImage[];
}

export const projects: ProjectItem[] = [
  {
    id: "doorlink",
    tone: "slate",
    title: "Doorlink",
    category: "Embedded systems · self-hosted IoT",
    status: "Working prototype",
    summary:
      "A self-hosted smart doorbell with a hand-assembled, custom-designed PCB built around the ESP32-S3-WROOM-1 module and a Raspberry Pi 4B gateway. When a visitor presses the button, the device wakes, captures and uploads an image, triggers a notification, and returns to deep sleep. The dashboard also supports recorded voice replies.",
    evidence: [
      {
        heading: "Custom Hardware",
        detail:
          "The Rev C board was designed and routed in KiCad. It connects an OV5640 camera, microphone, speaker, and battery power circuitry to an ESP32-S3-WROOM-1 module with 8 MB of PSRAM for camera and audio buffers.",
      },
      {
        heading: "Device-to-Dashboard Flow",
        detail:
          "ESP-IDF firmware sends doorbell events to a Spring Boot gateway. PostgreSQL stores event records, MinIO stores images and audio, Mosquitto handles MQTT device commands, and Next.js provides the dashboard.",
      },
      {
        heading: "Validation Status",
        detail:
          "Image capture, upload, deep sleep, and audio features have been tested on the battery-powered prototype. The latest firmware still needs a final test on the device, and current draw has yet to be measured with the enclosure closed.",
      },
    ],
    tags: ["C/C++ · ESP-IDF", "Java · Spring Boot", "TypeScript · Next.js", "PostgreSQL", "MQTT", "ESP32-S3", "KiCad", "Soldering"],
    additionalTags: ["React", "Raspberry Pi 4B", "MinIO", "Mosquitto"],
    images: [
      {
        src: "/projects/doorlink-enclosure.jpg",
        alt: "Finished Doorlink doorbell enclosure mounted on a wall",
        caption: "Finished doorbell enclosure",
        width: 2370,
        height: 3771,
      },
      {
        src: "/projects/doorlink-pcb.jpg",
        alt: "Doorlink Rev C circuit board fitted inside its doorbell enclosure",
        caption: "Rev C board in the doorbell enclosure",
        width: 900,
        height: 1200,
      },
      {
        src: "/projects/doorlink-wiring.webp",
        alt: "Doorlink circuit board connected to the doorbell button, speaker, and battery during assembly",
        caption: "Doorlink wiring and internal assembly",
        width: 1200,
        height: 1600,
      },
      {
        src: "/projects/doorlink-pcb-3d.png",
        alt: "KiCad 3D rendering of the Doorlink Rev C circuit board",
        caption: "Rev C board design in KiCad",
        width: 2363,
        height: 1278,
      },
      {
        src: "/projects/doorlink-pcb-layout.png",
        alt: "KiCad PCB layout showing routed copper traces and layer structure for the Doorlink Rev C board",
        caption: "Rev C PCB layout in KiCad",
        width: 689,
        height: 1158,
      },
    ],
    links: [
      {
        label: "Doorlink GitHub",
        url: "https://github.com/calebhabesh/doorlink",
        type: "github",
        ariaLabel: "Doorlink GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "linewatch",
    tone: "clay",
    title: "LineWatchTO",
    category: "Transit intelligence · full stack",
    status: "Live",
    summary:
      "A transit dashboard for TTC, GO Transit, and UP Express riders. It brings service alerts, planned closures, station arrivals, and disruption checks for saved commutes into one map view. It clearly labels outdated data, scheduled arrivals, unavailable information, and demo data.",
    evidence: [
      {
        heading: "Two Networks",
        detail:
          "Custom maps for TTC and GO Transit / UP Express show service disruptions and station details for each network's lines and stops.",
      },
      {
        heading: "Personal Impact",
        detail:
          "Saved commutes and stations help riders find disruptions that affect them. Optional notifications flag relevant alerts, and the progressive web app (PWA) saves dashboard snapshots for offline viewing.",
      },
      {
        heading: "Freshness Rules",
        detail:
          "A Java and Spring Boot backend ingests transit feeds, with PostGIS for geographic data and Redis for caching. Alerts link to their sources, and outdated source data is labeled rather than shown as current.",
      },
      {
        heading: "Delivery Pipeline",
        detail:
          "GitHub Actions runs frontend and backend checks and publishes ARM64 Docker images to GitHub Container Registry (GHCR). Manually triggered releases include database backups and smoke tests against the public site.",
      },
      {
        heading: "Production Hosting",
        detail:
          "The production service runs on an Ampere virtual machine in Oracle Cloud Infrastructure (OCI), with 4 OCPUs and 24 GB of RAM. It uses Ubuntu 24.04, Docker Compose, and Caddy for HTTPS.",
      },
      {
        heading: "AWS Infrastructure Lab",
        detail:
          "A separate Terraform lab defines an ARM64 Amazon EC2 deployment. It uses AWS IAM and Systems Manager for access, Amazon S3 for artifacts, and AWS Lambda with Amazon EventBridge to stop the instance on a schedule. Production is hosted on OCI.",
      },
    ],
    tags: ["TypeScript · Next.js", "Java · Spring Boot", "PostgreSQL · PostGIS", "Redis", "GTFS · GTFS Realtime", "Docker", "Grafana", "GitHub Actions", "AWS (Lab)"],
    additionalTags: ["React", "MapLibre GL JS", "PWA", "Web Push", "Terraform", "Oracle Cloud Infrastructure", "Ubuntu", "Caddy"],
    images: [
      {
        src: "/projects/linewatch-onboarding-map.png",
        alt: "LineWatchTO TTC map showing a suspension, delay, reduced speed zone, and station impact",
        caption: "TTC map and service disruptions",
        width: 1320,
        height: 764,
      },
      {
        src: "/projects/linewatch-onboarding-impact.png",
        alt: "LineWatchTO showing details for a selected reduced speed zone beside the highlighted map segment",
        caption: "Selected disruption and affected map segment",
        width: 2880,
        height: 1620,
      },
      {
        src: "/projects/linewatch-onboarding-personal.png",
        alt: "LineWatchTO My Commutes panel showing a saved route with current disruptions and details for a planned departure",
        caption: "My Commutes: saved route and service impact",
        width: 1120,
        height: 1082,
      },
      {
        src: "/projects/linewatch-onboarding-stations.png",
        alt: "LineWatchTO My Stations panel showing a saved station, active disruptions, and upcoming arrivals",
        caption: "My Stations: disruptions and arrivals",
        width: 1056,
        height: 1020,
      },
    ],
    links: [
      {
        label: "Visit LineWatchTO",
        url: "https://linewatchto.ca",
        type: "live",
        ariaLabel: "Visit LineWatchTO (opens in new tab)",
        external: true,
      },
      {
        label: "LineWatchTO GitHub",
        url: "https://github.com/calebhabesh/linewatchto",
        type: "github",
        ariaLabel: "LineWatchTO GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "orbit",
    tone: "ochre",
    title: "Orbit",
    category: "Distributed systems · networking",
    status: "In development",
    summary:
      "A peer-to-peer file sync daemon for Linux, written in Go with its own sync engine. Edits made on separate devices while offline are kept side by side for review instead of one silently overwriting the other, and devices on different networks connect without a VPN.",
    evidence: [
      {
        heading: "Causal History",
        detail:
          "SQLite records why each file version exists, so independent edits are detected and preserved. Earlier versions can be restored, and files move in verified 1 MiB chunks that resume after an interruption.",
      },
      {
        heading: "Crash Safety",
        detail:
          "New contents are staged and published through a recovery journal. Fault-injection tests, 16 abrupt VM resets and five full-disk cases kept protected files intact.",
      },
      {
        heading: "Across Networks",
        detail:
          "Devices pair over mutual TLS and connect directly over QUIC with ICE/STUN when possible, falling back to a relay that only sees ciphertext. Between a home network and an Oracle Cloud VM, a 4 MiB version arrived over direct UDP in 6–9 seconds.",
      },
      {
        heading: "Three Real Hosts",
        detail:
          "Packaged builds on a Linux laptop, a Raspberry Pi 4B and a cloud VM converged to matching contents. Testing on real networks found a relay-recovery bug that previously never recovered within 180 seconds; it now recovers in about 5.5 seconds.",
      },
    ],
    tags: ["Go", "SQLite", "Mutual TLS (mTLS)", "QUIC · ICE", "Linux"],
    additionalTags: ["TypeScript · React", "WebSocket", ".deb · .rpm"],
    images: [
      {
        src: "/projects/orbit-history.png",
        alt: "Orbit operator console showing workspace files and version history",
        caption: "Workspace files and version history",
        width: 1200,
        height: 750,
      },
      {
        src: "/projects/orbit-folders.png",
        alt: "Orbit operator console showing registered folders and a persistent work queue",
        caption: "Registered folders and work queue",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/orbit-conflicts.png",
        alt: "Orbit console showing two preserved versions of a conflicting file",
        caption: "Conflicting file versions",
        width: 1280,
        height: 800,
      },
    ],
    links: [
      {
        label: "Orbit GitHub",
        url: "https://github.com/calebhabesh/orbit",
        type: "github",
        ariaLabel: "Orbit GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "courtlens",
    tone: "sage",
    title: "CourtLens",
    category: "Data engineering · ML · statistics",
    status: "In development",
    summary:
      "An NBA research workbench covering six seasons and 104,533 player games. Every number traces to a source version and a cutoff date, forecasts are scored against what actually happened, and an assistant answers questions from the warehouse.",
    evidence: [
      {
        heading: "Versioned Warehouse",
        detail:
          "Python ingestion and 39 tested dbt models build PostgreSQL serving marts from content-hashed inputs. Releases are published by an atomic pointer swap, so a failed rebuild never replaces the last good release.",
      },
      {
        heading: "No Look-Ahead",
        detail:
          "Features use only games before the replay date, and players traded mid-season keep separate team stints. A missing box score is recorded as unknown, not as zero points.",
      },
      {
        heading: "Impact Ratings",
        detail:
          "202,063 lineup stints rebuilt from public play-by-play feed ridge-regression RAPM, on/off and six-factor ratings, shown with sample sizes and source gaps.",
      },
      {
        heading: "Forecast Evaluation",
        detail:
          "Across 10 chronological folds, a prior-season blend reached a 4.88-point mean absolute error against a rolling baseline's 5.09, with 81.2% of results inside the 80% interval. A gradient-boosted model was tested and not adopted.",
      },
      {
        heading: "Checked Assistant",
        detail:
          "A tool-calling agent queries the warehouse through read-only tools, and numbers in its answers are checked against query results. It is evaluated against independently computed SQL answers.",
      },
    ],
    tags: ["Python · FastAPI", "SQL · dbt", "PostgreSQL", "scikit-learn", "TypeScript · Next.js"],
    additionalTags: ["React", "SQLAlchemy", "Alembic", "Docker", "LLM tool calling"],
    images: [
      {
        src: "/projects/courtlens-comparison.png",
        alt: "CourtLens dashboard comparing LeBron James and Stephen Curry",
        caption: "Historical player comparison dashboard",
        width: 749,
        height: 1200,
      },
      {
        src: "/projects/courtlens-evaluation.png",
        alt: "CourtLens evaluation page comparing historical model error and coverage",
        caption: "Model evaluation on later games",
        width: 1440,
        height: 2817,
      },
    ],
    links: [],
  },
  {
    id: "medical-imaging",
    tone: "lilac",
    title: "Medical Image Processing",
    category: "Parallel computing · team capstone",
    status: "Capstone",
    summary:
      "A four-person C++ capstone exploring parallel image processing with FAST and OpenMP. A 2026 refresh adds a working stage demo and verified benchmarks.",
    evidence: [
      {
        heading: "Pipeline",
        detail:
          "The pipeline uses FAST to import DICOM scans, preprocess images, segment regions, apply morphological operations, and export the results.",
      },
      {
        heading: "Parallel Design",
        detail:
          "One producer owns the FAST GPU pipeline while OpenMP workers convert and export completed images. Bounded batches limit the images held in memory.",
      },
      {
        heading: "2026 Verification",
        detail:
          "Eight OpenMP threads achieved 3.15× throughput for processing and lossless export of 460 slices across five measured repetitions. Every mask and PNG matched the sequential reference byte for byte.",
      },
    ],
    tags: ["C++17", "OpenMP", "FAST", "DICOM"],
    additionalTags: ["CMake"],
    images: [
      {
        src: "/projects/medical-imaging/stage-viewer.png",
        alt: "Native C++ viewer comparing the original capstone brain MRI with its sharpened output",
        caption: "Original capstone MRI · native filter walkthrough",
        width: 1120,
        height: 940,
      },
      {
        src: "/projects/medical-imaging/export-benchmark.svg",
        alt: "Repeated benchmark results for processing and lossless export: median runtime falls from 28.92 seconds with one OpenMP thread to 9.18 seconds with eight",
        caption: "2026 benchmark · processing and lossless export",
        width: 1000,
        height: 530,
      },
    ],
    links: [
      {
        label: "Watch Capstone Demo",
        url: "https://github.com/calebhabesh/NM03-Capstone-Project#demo",
        type: "demo",
        ariaLabel: "Watch the Medical Image Processing videos in the GitHub README (opens in new tab)",
        external: true,
      },
      {
        label: "Capstone GitHub",
        url: "https://github.com/calebhabesh/NM03-Capstone-Project",
        type: "github",
        ariaLabel: "Medical Image Processing capstone repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "systemc-noc",
    tone: "teal",
    title: "4×4 NoC Simulator",
    category: "SoC architecture · SystemC simulation",
    status: "Course project",
    summary:
      "A 16-node network-on-chip simulator with XY routing, five-port routers, input buffering, and wormhole output reservations. A 2026 refresh adds end-to-end delivery checks and a traffic-load comparison.",
    evidence: [
      {
        heading: "Course Origin",
        detail:
          "Built for COE838 in winter 2025 by extending a supplied 1×2 SystemC baseline into a 4×4 mesh. The work adds node connectivity, coordinate routing, configurable destinations, and traffic patterns; the router infrastructure derives from the course baseline.",
      },
      {
        heading: "2026 Verification",
        detail:
          "Fifteen traffic scenarios each deliver 1,600 flits, or 320 five-flit packets. An automated scoreboard checks destination, payload, source order, and packet completion, with guards against FIFO overflow and underflow.",
      },
      {
        heading: "Traffic Comparison",
        detail:
          "Neighbour, deterministic stride, and hotspot traffic run at five injection periods. The simulator measures flit latency, packet latency, and delivery throughput. Hotspot traffic exposes contention and the effect of holding an output while a packet is generated.",
      },
      {
        heading: "Evidence Scope",
        detail:
          "This is a SystemC architecture model. Results are simulated timings, with raw CSV data and repeatable checks in the repository. The project does not include synthesized RTL or FPGA board execution.",
      },
    ],
    tags: ["C++17", "SystemC", "CMake", "NoC", "XY Routing"],
    additionalTags: ["SoC", "Wormhole Routing", "FIFO", "Arbitration", "Flow Control"],
    images: [
      {
        src: "/projects/systemc-noc/traffic-sweep.png",
        alt: "SystemC traffic sweep comparing mean flit latency and aggregate delivered throughput for neighbour, stride, and hotspot traffic at five injection periods",
        caption: "2026 simulation · 1,600 verified flits per run",
        width: 1920,
        height: 736,
      },
    ],
    links: [
      {
        label: "NoC GitHub",
        url: "https://github.com/calebhabesh/systemc-noc",
        type: "github",
        ariaLabel: "4×4 SystemC NoC simulator repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "fpga-pong",
    tone: "orange",
    title: "FPGA VGA Pong",
    category: "Digital hardware · VHDL and VGA",
    status: "Course project",
    summary:
      "A two-player VHDL Pong game built on a Spartan-3E FPGA, with VGA video, switch-controlled paddles, and collision logic. Preserved board-demo evidence accompanies a 2026 RTL simulation refresh.",
    evidence: [
      {
        heading: "Historical Board Demo",
        detail:
          "The COE758 fall 2024 project ran on a Spartan-3E XC3S500E with the lab's video DAC. A photograph from the final report shows the game on a monitor alongside the board. That demonstration uses the original submitted design.",
      },
      {
        heading: "2026 RTL Refresh",
        detail:
          "The refresh separates video timing, game state, and rendering. All internal registers use the 50 MHz board clock with pixel and motion enables, and two-stage synchronizers handle switch inputs. Clock constraints and complete RGB sensitivity remove gaps in the archived design.",
      },
      {
        heading: "Automated Verification",
        detail:
          "GHDL checks a full 800×525 frame with 640×480 active video, sync timing, blanking, colors, and the DAC clock. Separate gameplay checks exercise paddle bounds, collisions, and goal reset. The frame shown here comes directly from the RTL outputs.",
      },
      {
        heading: "Evidence Scope",
        detail:
          "The refreshed RTL passes simulation and GHDL synthesis elaboration. It still needs target-specific timing closure and a new board run; the preserved photograph establishes historical hardware execution.",
      },
    ],
    tags: ["VHDL", "RTL", "FPGA", "VGA", "GHDL", "Spartan-3E"],
    additionalTags: ["Clock Enables", "Input Synchronization", "Hardware Verification"],
    images: [
      {
        src: "/projects/fpga-pong/board-demo-2024.webp",
        alt: "Original Pong game displayed on an LG monitor, with the Spartan-3E FPGA board and video connection visible beside it",
        caption: "2024 board demo · original submitted design",
        width: 1080,
        height: 597,
      },
      {
        src: "/projects/fpga-pong/rtl-frame-2026.png",
        alt: "Frame captured from the refreshed VHDL showing a green Pong court, white border, blue and magenta paddles, and yellow ball",
        caption: "2026 simulation · frame captured from VHDL outputs",
        width: 640,
        height: 480,
      },
    ],
    links: [
      {
        label: "Pong GitHub",
        url: "https://github.com/calebhabesh/fpga-pong",
        type: "github",
        ariaLabel: "FPGA VGA Pong repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "portfolio-site",
    tone: "rose",
    title: "Portfolio Site",
    category: "Personal website · interactive frontend",
    status: "Live",
    summary:
      "The site you are currently viewing! This portfolio brings together project write-ups, searchable technologies, and image galleries around an interactive 3D lion emblem. A blueprint grid and sketched details carry through light and dark themes, with keyboard navigation and reduced-motion support.",
    evidence: [
      {
        heading: "Project Exploration",
        detail:
          "React cards expand into accessible dialogs with project evidence and image galleries. Technology search supports combined terms, aliases, and small typos while keeping the card grid stable.",
      },
      {
        heading: "Interactive Graphics",
        detail:
          "Three.js renders the lion emblem with baked textures and a collision field. Motion animates project transitions, and an A* pathfinding visualization runs in the blueprint gutters.",
      },
      {
        heading: "Static Delivery and Verification",
        detail:
          "Vite builds a static site with generated project markup available before React loads. Playwright checks desktop and mobile layouts, keyboard focus, themes, reduced motion, and browser errors; axe checks accessibility.",
      },
      {
        heading: "Hosting",
        detail:
          "Hosted on an Oracle Cloud Infrastructure (OCI) VPS, with Docker Compose and Caddy serving the static site. A dedicated Cloudflare Tunnel connects the origin to the public domain, with Cloudflare providing HTTPS. Releases are uploaded and activated atomically, with previous releases retained for rollback.",
      },
    ],
    tags: ["TypeScript · React", "Three.js", "Vite", "Tailwind CSS", "Motion", "Playwright"],
    additionalTags: ["JavaScript", "Accessibility", "A* Pathfinding"],
    links: [
      {
        label: "Visit Portfolio",
        url: "https://calebhabesh.com/",
        type: "live",
        ariaLabel: "Visit Caleb Habesh's portfolio (opens in new tab)",
        external: true,
      },
      {
        label: "Portfolio GitHub",
        url: "https://github.com/calebhabesh/portfolio",
        type: "github",
        ariaLabel: "Portfolio site GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
];
