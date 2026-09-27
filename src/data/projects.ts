export interface ProjectEvidence {
  heading: string;
  detail: string;
}

export interface ProjectLink {
  label: string;
  url: string;
  type: "live" | "github";
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
    title: "Doorlink",
    category: "Embedded systems · self-hosted IoT",
    status: "Working prototype",
    summary:
      "A self-hosted smart doorbell built on a hand-assembled ESP32-S3 PCB and Raspberry Pi gateway. A button press wakes the device, captures a visitor image, sends a notification, and returns to deep sleep; the dashboard also supports stored, turn-based voice replies.",
    evidence: [
      {
        heading: "Custom hardware",
        detail:
          "The Rev C board combines an OV5640 camera, microphone, speaker, battery power path, and routed KiCad design.",
      },
      {
        heading: "Device-to-dashboard flow",
        detail:
          "ESP-IDF firmware sends events to a Spring Boot gateway with PostgreSQL, MinIO media storage, MQTT, and a Next.js interface.",
      },
      {
        heading: "Validation boundary",
        detail:
          "The battery-powered capture/upload/sleep path and audio paths have run on hardware. Final hardened-firmware retest and closed-enclosure current measurements remain.",
      },
    ],
    tags: ["C/C++ · ESP-IDF", "Java · Spring Boot", "TypeScript · Next.js", "PostgreSQL", "MQTT", "ESP32-S3 · KiCad"],
    additionalTags: ["React", "Raspberry Pi", "MinIO", "Mosquitto"],
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
    title: "LineWatchTO",
    category: "Transit intelligence · full stack",
    status: "Live",
    summary:
      "A map-first reliability dashboard for TTC and GO/UP riders. It brings service alerts, planned closures, station arrivals, and saved-commute impact checks into one view, while labeling stale, scheduled, unavailable, and demo data honestly.",
    evidence: [
      {
        heading: "Two networks",
        detail:
          "Custom TTC and GO/UP map views connect incidents and station details to the lines and stops riders care about.",
      },
      {
        heading: "Personal impact",
        detail:
          "Saved commutes and stations surface relevant disruptions, with optional notifications and offline PWA snapshots.",
      },
      {
        heading: "Freshness rules",
        detail:
          "Java/Spring ingestion, PostGIS, and Redis support source-linked alerts; stale upstream data is not shown as current.",
      },
    ],
    tags: ["TypeScript · Next.js", "Java · Spring Boot", "PostgreSQL · PostGIS", "Redis", "MapLibre", "GTFS / GTFS-RT"],
    additionalTags: ["React", "PWA", "Web Push", "Docker Compose", "Caddy"],
    images: [
      {
        src: "/projects/linewatch-onboarding-map.png",
        alt: "LineWatchTO TTC map showing a suspension, delay, reduced speed zone, and station impact",
        caption: "TTC map and service impact patterns",
        width: 1320,
        height: 764,
      },
      {
        src: "/projects/linewatch-onboarding-impact.png",
        alt: "LineWatchTO selected reduced speed zone details beside its highlighted map segment",
        caption: "Selected service impact and map segment",
        width: 2880,
        height: 1620,
      },
      {
        src: "/projects/linewatch-onboarding-personal.png",
        alt: "LineWatchTO My Commutes panel showing a saved route with current impact and planning-time details",
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
    title: "File Sync",
    category: "Distributed systems · local-first files",
    status: "Pilot tested",
    summary:
      "A Go peer-to-peer file sync daemon for trusted Linux devices. It keeps causal version history, transfers content-addressed chunks over authenticated peer connections, and exposes concurrent edits for deliberate resolution through a local interface instead of silently replacing a file.",
    evidence: [
      {
        heading: "Causal history",
        detail:
          "Immutable version heads and vector clocks preserve offline edits; the local UI lets users inspect history and conflicts.",
      },
      {
        heading: "Recovery",
        detail:
          "SQLite metadata, atomic chunk staging, and fault-injection tests exercise crash durability.",
      },
      {
        heading: "Real workflow",
        detail:
          "A workstation, Raspberry Pi, and cloud relay were used in a three-host pilot; the repository also has a local multi-process demo.",
      },
    ],
    tags: ["Go", "TypeScript · React", "SQLite", "mTLS", "Linux"],
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
        alt: "File Sync operator console showing registered folders and durable work queue",
        caption: "Registered folders and work queue",
        width: 1280,
        height: 800,
      },
      {
        src: "/projects/filesync-conflicts.png",
        alt: "File Sync console showing two preserved versions of a conflicting file",
        caption: "Concurrent edit conflict view",
        width: 1280,
        height: 800,
      },
    ],
    links: [
      {
        label: "File Sync GitHub",
        url: "https://github.com/calebhabesh/file-sync",
        type: "github",
        ariaLabel: "File Sync GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "courtload",
    title: "CourtLoad",
    category: "NBA analytics · data engineering",
    status: "Complete",
    summary:
      "An NBA player comparison and analytics dashboard built from three historical regular seasons. It lets users compare player form, usage, and matchup context with source-traceable data and uncertainty informed by time-safe evaluation.",
    evidence: [
      {
        heading: "Reproducible data",
        detail:
          "Python ingestion, PostgreSQL, and tested dbt models turn pinned schedules and box scores into dated player and opponent views.",
      },
      {
        heading: "Useful comparison",
        detail:
          "A Next.js dashboard and FastAPI service show side-by-side trends, game logs, and matchup context.",
      },
      {
        heading: "Honest modeling",
        detail:
          "Out-of-time evaluation kept the EWMA baseline after a gradient-boosted challenger failed promotion gates; the evaluation is shown to users.",
      },
    ],
    tags: ["Python · FastAPI", "TypeScript · Next.js", "SQL · dbt", "PostgreSQL"],
    additionalTags: ["React", "SQLAlchemy", "Alembic", "Docker Compose", "scikit-learn · Evaluation"],
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
        caption: "Out-of-time model evaluation",
        width: 1440,
        height: 2817,
      },
    ],
    links: [
      {
        label: "CourtLoad GitHub",
        url: "https://github.com/calebhabesh/courtload",
        type: "github",
        ariaLabel: "CourtLoad GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "medical-imaging",
    title: "Medical Imaging",
    category: "Parallel computing · team capstone",
    status: "Capstone",
    summary:
      "A C++ medical-imaging pipeline for processing DICOM brain scans with FAST and OpenMP. The team batched image work across CPU threads and compared sequential and parallel execution through performance analysis.",
    evidence: [
      {
        heading: "Pipeline",
        detail:
          "DICOM ingest, preprocessing, segmentation, morphological operations, and export were integrated with FAST.",
      },
      {
        heading: "Parallel design",
        detail:
          "OpenMP distributes scan batches across CPU threads.",
      },
      {
        heading: "Evaluation",
        detail:
          "Benchmark tooling compares execution modes; present a numerical speedup only if the result and personal contribution can be cited.",
      },
    ],
    tags: ["C++17", "OpenMP", "FAST", "DICOM"],
    additionalTags: ["CMake"],
    images: [
      {
        src: "/projects/medical-segmentation.png",
        alt: "Medical imaging application showing an MRI slice through successive processing and segmentation stages",
        caption: "MRI processing and segmentation stages",
        width: 881,
        height: 210,
      },
      {
        src: "/projects/medical-pipelines.png",
        alt: "Initial and revised medical image processing pipeline flowcharts",
        caption: "Initial and revised processing pipelines",
        width: 919,
        height: 566,
      },
    ],
    links: [
      {
        label: "Capstone GitHub",
        url: "https://github.com/calebhabesh/NM03-Capstone-Project",
        type: "github",
        ariaLabel: "Medical Imaging capstone repository (opens in new tab)",
        external: true,
      },
    ],
  },
];
