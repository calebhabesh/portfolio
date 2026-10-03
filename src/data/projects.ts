export interface ProjectEvidence {
  heading: string;
  detail: string;
}

export interface ProjectLink {
  label: string;
  url: string;
  type: "live" | "github" | "demo";
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
  tone: "sage" | "slate" | "clay" | "ochre" | "lilac";
  title: string;
  category: string;
  status: "Working prototype" | "Live" | "Pilot tested" | "Complete" | "Capstone";
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
    tags: ["C/C++ · ESP-IDF", "Java · Spring Boot", "TypeScript · Next.js", "PostgreSQL", "MQTT", "ESP32-S3 · KiCad", "Soldering"],
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
    id: "file-sync",
    tone: "ochre",
    title: "File Sync",
    category: "Distributed systems · local-first files",
    status: "Pilot tested",
    summary:
      "A Go peer-to-peer file sync daemon for Linux devices. It preserves concurrent edits and transfers content-addressed chunks over authenticated connections.",
    evidence: [
      {
        heading: "Causal History",
        detail:
          "Immutable version records and vector clocks track edits made while devices are offline. The local interface lets users inspect file history and resolve conflicts.",
      },
      {
        heading: "Recovery",
        detail:
          "SQLite stores metadata, and atomic staging protects file chunks during writes. Fault-injection tests check that stored data survives crashes.",
      },
      {
        heading: "Real Workflow",
        detail:
          "A pilot tested synchronization across a workstation, a Raspberry Pi 4B, and a cloud relay. A local demo also runs multiple peer processes on one machine.",
      },
    ],
    tags: ["Go", "TypeScript · React", "SQLite", "Mutual TLS (mTLS)", "Linux"],
    images: [
      {
        src: "/projects/filesync-history.png",
        alt: "File Sync operator console showing workspace files and version history",
        caption: "Workspace files and version history",
        width: 1200,
        height: 750,
      },
      {
        src: "/projects/filesync-folders.png",
        alt: "File Sync operator console showing registered folders and a persistent work queue",
        caption: "Registered folders and work queue",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/filesync-conflicts.png",
        alt: "File Sync console showing two preserved versions of a conflicting file",
        caption: "Conflicting file versions",
        width: 1280,
        height: 800,
      },
    ],
    links: [],
  },
  {
    id: "courtload",
    tone: "sage",
    title: "CourtLoad",
    category: "NBA analytics · data engineering",
    status: "Complete",
    summary:
      "An NBA analytics dashboard comparing player form and matchups across three historical seasons, with source-linked stats and tested prediction intervals.",
    evidence: [
      {
        heading: "Reproducible Data",
        detail:
          "A Python ingestion pipeline, PostgreSQL, and tested dbt models turn fixed versions of schedules and box scores into player and opponent statistics for a selected date.",
      },
      {
        heading: "Player Comparison",
        detail:
          "A Next.js dashboard backed by FastAPI shows player trends side by side, along with game logs and matchup context.",
      },
      {
        heading: "Model Evaluation",
        detail:
          "Evaluation on later games retained the exponentially weighted moving average (EWMA) baseline because a gradient-boosted model failed the acceptance criteria. Users can view the evaluation results in the dashboard.",
      },
    ],
    tags: ["Python · FastAPI", "TypeScript · Next.js", "SQL · dbt", "PostgreSQL"],
    additionalTags: ["React", "SQLAlchemy", "Alembic", "Docker", "scikit-learn"],
    images: [
      {
        src: "/projects/courtload-comparison.png",
        alt: "CourtLoad dashboard comparing LeBron James and Stephen Curry",
        caption: "Historical player comparison dashboard",
        width: 749,
        height: 1200,
      },
      {
        src: "/projects/courtload-evaluation.png",
        alt: "CourtLoad evaluation page comparing historical model error and coverage",
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
];
