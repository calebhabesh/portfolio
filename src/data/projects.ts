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
  // Shown but not clickable until the destination is published.
  pending?: boolean;
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
  // Short role descriptor shown after the title, matching the resume entry.
  descriptor: string;
  category: string;
  // Start and end months, matching the resume entry.
  dates: string;
  status: "Working prototype" | "Live" | "Live · Privately self-hosted" | "In development" | "Complete" | "Capstone" | "Course project";
  summary: string;
  evidence: ProjectEvidence[];
  tags: string[];
  additionalTags?: string[];
  links: ProjectLink[];
  // False when visitors are already looking at the project, so the card shows no live or demo action.
  showcase?: false;
  images?: ProjectImage[];
}

export const projects: ProjectItem[] = [
  {
    id: "doorlink",
    tone: "slate",
    title: "Doorlink",
    descriptor: "Custom-PCB Smart Doorbell",
    category: "Embedded systems · self-hosted IoT",
    dates: "May 2026 – Sept 2026",
    status: "Live · Privately self-hosted",
    summary:
      "A privately self-hosted smart doorbell in daily use, with a hand-assembled, custom-designed PCB built around the ESP32-S3-WROOM-1 module and a Raspberry Pi 4B gateway. When a visitor presses the button, the device wakes, captures and uploads an image, triggers an ntfy notification, and returns to deep sleep. The dashboard also supports recorded voice replies.",
    evidence: [
      {
        heading: "Custom Hardware",
        detail:
          "The Rev C board was designed and routed in KiCad. It connects an OV5640 camera, microphone, speaker, and battery power circuitry to an ESP32-S3-WROOM-1 module with 8 MB of PSRAM for camera and audio buffers. Moving the audio playback buffers off the main task stack reduced its largest frame from 4,368 to 368 bytes.",
      },
      {
        heading: "Device-to-Dashboard Flow",
        detail:
          "ESP-IDF firmware sends doorbell events to a Spring Boot gateway. PostgreSQL stores event records, MinIO stores images and audio, Mosquitto handles MQTT device commands, and Next.js provides the dashboard. The gateway and dashboard are privately self-hosted on a Raspberry Pi 4B behind a Cloudflare Tunnel, with no open router ports.",
      },
      {
        heading: "In Daily Use",
        detail:
          "The doorbell is mounted and in active use at home. Over four weeks and 97 button presses, it delivered all 24 visitor photos with a 2.9-second median from press alert to stored image, while drawing under 1 mA on average for roughly 12 weeks of battery life per charge.",
      },
      {
        heading: "Household Alerts",
        detail:
          "The gateway triggers a Home Assistant webhook to play a chime on all home smart speakers, supplementing the doorbell's local chime. It also sends ntfy notifications to household members' phones and computers. Tapping a notification opens the Doorlink dashboard in their browser.",
      },
    ],
    tags: ["C · C++ · ESP-IDF", "Java · Spring Boot", "TypeScript · Next.js", "PostgreSQL", "MQTT", "ESP32-S3", "KiCad", "Soldering"],
    additionalTags: ["React", "Raspberry Pi 4B", "MinIO", "Mosquitto", "Home Assistant", "ntfy"],
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
        width: 600,
        height: 866,
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
        label: "Watch Doorlink Demo",
        url: "https://github.com/calebhabesh/doorlink#demo",
        type: "demo",
        ariaLabel: "Watch the Doorlink live demo video in the GitHub README (opens in new tab)",
        external: true,
      },
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
    descriptor: "Transit Reliability Platform",
    category: "Transit intelligence · full stack",
    dates: "May 2026 – Nov 2026",
    status: "Live",
    summary:
      "A transit dashboard for TTC, GO Transit, and UP Express riders, purpose-built for both desktop web and an installable mobile PWA. It maps service alerts, planned closures, station arrivals, and disruptions affecting saved commutes, clearly labeling outdated data, scheduled arrivals, unavailable information, and demo data.",
    evidence: [
      {
        heading: "Two Networks",
        detail:
          "Custom maps for TTC and GO Transit / UP Express show service disruptions and station details for each network's lines and stops, with purpose-built layouts for desktop and mobile. A geographic map adds streetcar, bus, and night routes with live vehicle positions and stop departures, and one search box finds any of 9,830 stops by stop number or street names.",
      },
      {
        heading: "Personal Impact",
        detail:
          "Saved commutes and stations help riders find disruptions that affect them. Optional notifications flag relevant alerts, and the progressive web app (PWA) saves dashboard snapshots for offline viewing.",
      },
      {
        heading: "Freshness Rules",
        detail:
          "A Java and Spring Boot backend ingests transit feeds, with PostGIS for geographic data and Redis for caching. Alerts link to their sources, and outdated source data is labeled rather than shown as current. Across 91 days in production, the ingestion job completed 99.98% of 296,520 runs and pulled 30.3 million source records.",
      },
      {
        heading: "Delivery Pipeline",
        detail:
          "GitHub Actions runs frontend and backend checks and publishes ARM64 Docker images to GitHub Container Registry (GHCR). Manually triggered releases include database backups and smoke tests against the public site.",
      },
      {
        heading: "Production Hosting",
        detail:
          "The production service runs on an Ampere virtual machine in Oracle Cloud Infrastructure (OCI), with 4 OCPUs and 24 GB of RAM. It uses Ubuntu 24.04, Docker Compose, and Caddy for HTTPS, with Cloudflare caching public API responses at a 10.5 ms median.",
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
        src: "/projects/linewatch-ttc-dashboard.webp",
        alt: "LineWatchTO dashboard with the current TTC service panel beside the full subway and LRT map, showing a planned closure, reduced speed zones, and status for each line",
        caption: "Live TTC service status across the full network",
        width: 2560,
        height: 1440,
      },
      {
        src: "/projects/linewatch-ttc-mobile.webp",
        alt: "Live TTC phone dashboard showing the map, current impact categories, and bottom navigation",
        caption: "Installable mobile dashboard",
        width: 824,
        height: 1830,
      },
      {
        src: "/projects/linewatch-station-details.webp",
        alt: "Union station details with source-labeled TTC subway arrivals and surface connections",
        caption: "Station details and source-labeled arrivals",
        width: 1120,
        height: 1792,
      },
      {
        src: "/projects/linewatch-regional-dashboard.webp",
        alt: "GO and UP regional dashboard with the full rail network and live network-specific status",
        caption: "GO and UP regional network status",
        width: 2560,
        height: 1440,
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
    descriptor: "Peer-to-Peer File Sync",
    category: "Distributed systems · networking",
    dates: "Aug 2026 – Oct 2026",
    status: "Complete",
    summary:
      "A peer-to-peer file sync daemon for Linux, written in Go with its own sync engine and driven from a CLI and a terminal user interface (TUI). Edits made on separate devices while offline are kept side by side for review instead of one silently overwriting the other, and devices on different networks connect without a VPN.",
    evidence: [
      {
        heading: "Causal History",
        detail:
          "SQLite records why each file version exists, so independent edits are detected and preserved. Earlier versions can be restored, and files move in verified 1 MiB chunks that resume after an interruption.",
      },
      {
        heading: "Crash Safety",
        detail:
          "New contents are staged and published through a recovery journal. Fault-injection tests, 16 abrupt VM resets and five storage-exhaustion cases kept protected files intact.",
      },
      {
        heading: "Across Networks",
        detail:
          "Devices pair over mutual TLS and connect directly over QUIC with ICE and STUN when possible, falling back to a relay that only sees ciphertext. Between a home network and an Oracle Cloud VM, a 4 MiB version arrived over direct UDP in 6–9 seconds.",
      },
      {
        heading: "Three Real Hosts",
        detail:
          "Packaged builds on a Linux laptop, a Raspberry Pi 4B and a cloud VM converged to matching contents. Testing on real networks found a relay-recovery bug that previously never recovered within 180 seconds; it now recovers in 5.4–5.5 seconds.",
      },
      {
        heading: "Stress Testing",
        detail:
          "A 30-minute soak with 10 devices, 53 daemon kills and 35 network outages ended with every device holding the same 382 files and the same preserved conflicts. The campaign found sync slowing as folders grew; batching receipts made idle sync rounds 26× cheaper.",
      },
    ],
    tags: ["Go", "SQLite", "Mutual TLS (mTLS)", "QUIC · ICE", "Linux"],
    additionalTags: ["Bubble Tea TUI", "WebSocket", ".deb · .rpm"],
    images: [
      {
        src: "/projects/orbit/demo-three-device-conflict.webp",
        alt: "Three Orbit terminal interfaces side by side for a laptop, desktop and Raspberry Pi, each flagging packing.txt as a conflict after the laptop edited it while offline, above a shell showing the commands that caused it",
        caption: "Demo · one offline edit, flagged on all three devices",
        width: 1920,
        height: 1080,
      },
      {
        src: "/projects/orbit/tui-review-versions.png",
        alt: "Orbit terminal review screen showing the laptop and Pi versions of plan.md preserved side by side, with editor, diff and keep-copies actions",
        caption: "Both versions preserved for reviewed resolution",
        width: 1116,
        height: 696,
      },
      {
        src: "/projects/orbit/soak-timeline.png",
        alt: "Churn soak timeline for 10 devices over 30 minutes with crash and outage windows shaded; after all faults heal, every device holds identical contents",
        caption: "10-device churn soak · exact convergence after healing",
        width: 1647,
        height: 781,
      },
      {
        src: "/projects/orbit/network-matrix.png",
        alt: "NAT traversal results: direct paths established in 10 of 10 runs on a LAN, through port-preserving NAT and to a public TCP host, and 0 of 10 through symmetric NAT or blocked UDP, which use the relay; 64 MiB throughput 12.6, 4.2 and 1.6 MiB/s over LAN QUIC, NAT QUIC and relay",
        caption: "NAT traversal matrix · 50 namespace runs",
        width: 1617,
        height: 797,
      },
      {
        src: "/projects/orbit/round-cost.png",
        alt: "Before and after batching receipts: an idle sync round over 900 versions drops from 19.1 to 0.72 seconds, and successive 300-file batches stop slowing down, from 41, 73 and 83 seconds to 41, 49 and 48",
        caption: "Fix found by measurement · batched receipts",
        width: 1755,
        height: 819,
      },
    ],
    links: [
      {
        label: "Watch Orbit Demo",
        url: "https://github.com/calebhabesh/orbit#demo",
        type: "demo",
        ariaLabel: "Watch the Orbit three-device demo in the GitHub README (opens in new tab)",
        external: true,
      },
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
    descriptor: "NBA Analytics Platform",
    category: "Data engineering · ML · statistics",
    dates: "Aug 2026 – Nov 2026",
    status: "Live",
    summary:
      "An NBA analytics site for exploring and comparing players and teams, with box scores back to 1983–84 and season totals back to 1946–47, 1.29 million player-game rows in all. Every number traces to a source version and a cutoff date, every research model is tested on seasons it never saw, and a win-probability model is graded after every game.",
    evidence: [
      {
        heading: "Versioned Warehouse",
        detail:
          "Python ingestion and tested dbt models build PostgreSQL serving marts from content-hashed inputs. Releases are published by an atomic pointer swap, so a failed rebuild never replaces the last good release. Backfilling 19,082 games from 1983–84 to 1999–2000 checked each game's player points against its final score, with no mismatches.",
      },
      {
        heading: "No Look-Ahead",
        detail:
          "Features use only games before the replay date, and players traded mid-season keep separate team stints. A missing box score is recorded as unknown, not as zero points. Each research model was registered before it was fit and tested once on held-out seasons, and the models that failed are published too.",
      },
      {
        heading: "Impact Ratings",
        detail:
          "719,529 lineup stints, rebuilt from 12 seasons of public play-by-play, feed ridge-regression RAPM (regularized adjusted plus-minus), on/off, and six-factor ratings, each with a confidence interval. With ratings fixed before each of 11,979 games, time-decayed RAPM predicted final margins better than every other metric tested.",
      },
      {
        heading: "Win Probability",
        detail:
          "A LightGBM model built on a random-walk baseline beat that baseline on 2,439 held-out games (log loss 0.403 against 0.416) and performed level with ESPN's model. Since it was frozen, each prediction is sealed before tip-off and graded after the final buzzer, beside ESPN and the betting line.",
      },
      {
        heading: "Checked Assistant",
        detail:
          "A tool-calling agent queries the warehouse through typed read-only tools. Numbers in its answers are checked against query results, and unsupported figures are flagged rather than presented as verified. Visitors sign in with Google, email, or a shared demo account to ask a few questions a day.",
      },
      {
        heading: "Production Hosting",
        detail:
          "An ARM64 virtual machine behind a Cloudflare Tunnel serves the site and runs every scheduled data job, including the nightly prediction grading. A read cache refilled after each data change cut warm page loads from up to 1.5 seconds to under 0.3 seconds, and weekly database backups are tested by restoring them.",
      },
    ],
    tags: ["Python · FastAPI", "SQL · dbt", "PostgreSQL", "LightGBM · scikit-learn", "TypeScript · Next.js"],
    additionalTags: ["React", "SQLAlchemy", "Alembic", "Docker", "LLM tool calling", "OAuth", "Cloudflare"],
    images: [
      {
        src: "/projects/courtlens/stats-explorer.webp",
        alt: "CourtLens Stats explorer listing 2025–26 players with impact, counting, and efficiency columns, each with a league percentile",
        caption: "Stats explorer with league percentiles",
        width: 2400,
        height: 1500,
      },
      {
        src: "/projects/courtlens/live-predictions.webp",
        alt: "CourtLens Live page for November 11, 2026, showing final scores with each game's sealed pregame pick marked right or wrong",
        caption: "Live scores · sealed picks graded after each game",
        width: 2400,
        height: 1500,
      },
      {
        src: "/projects/courtlens/win-probability.webp",
        alt: "CourtLens Win Probability evidence comparing its log loss with ESPN Analytics on the same game states, with the gap and its 95% interval",
        caption: "Win probability · tested against ESPN",
        width: 2400,
        height: 1500,
      },
      {
        src: "/projects/courtlens/rapm-leaders.webp",
        alt: "CourtLens RAPM Ratings page listing the 2025–26 leaders in one-year regularized adjusted plus-minus, with bars, games, and minutes",
        caption: "RAPM ratings from play-by-play",
        width: 2400,
        height: 1500,
      },
      {
        src: "/projects/courtlens/player-profile.webp",
        alt: "CourtLens profile for Scottie Barnes of the Toronto Raptors with biography details, 2026–27 stat tiles compared with career averages, and a season-by-season table",
        caption: "Player profile · season and career view",
        width: 2400,
        height: 1500,
      },
      {
        src: "/projects/courtlens/player-comparison.webp",
        alt: "CourtLens Player Comparison of Tyrese Maxey and Trae Young for 2026–27, with portrait cards above counting and efficiency rows and per-stat difference chips",
        caption: "Player comparison · per-stat differences",
        width: 2400,
        height: 2092,
      },
    ],
    links: [
      {
        label: "Visit CourtLens",
        url: "https://courtlens.calebhabesh.com",
        type: "live",
        ariaLabel: "Visit CourtLens (opens in new tab)",
        external: true,
      },
      {
        label: "CourtLens GitHub",
        url: "https://github.com/calebhabesh/courtlens",
        type: "github",
        ariaLabel: "CourtLens GitHub repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "medical-imaging",
    tone: "lilac",
    title: "Parallel MRI Processing",
    descriptor: "C++ and OpenMP Pipeline",
    category: "Parallel computing · team capstone",
    dates: "Sept 2024 – May 2025",
    status: "Capstone",
    summary:
      "A four-person C++ capstone exploring parallel image processing with FAST and OpenMP. A FAST pipeline filters and segments DICOM brain scans on the GPU while OpenMP workers convert and export the results in parallel. With eight threads, processing and lossless export of 460 slices ran 3.15× faster, and every output matched the sequential reference byte for byte.",
    evidence: [
      {
        heading: "Pipeline",
        detail:
          "The pipeline uses FAST to import DICOM scans, preprocess images, segment regions, apply morphological operations, and export the results. During the capstone, I served as Phase I project manager, set up the repository and build environment, and implemented the initial DICOM import stages.",
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
        ariaLabel: "Watch the Parallel MRI Processing videos in the GitHub README (opens in new tab)",
        external: true,
      },
      {
        label: "Capstone GitHub",
        url: "https://github.com/calebhabesh/NM03-Capstone-Project",
        type: "github",
        ariaLabel: "Parallel MRI Processing capstone repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "systemc-noc",
    tone: "teal",
    title: "SystemC NoC",
    descriptor: "Mesh Interconnect Simulator",
    category: "SoC architecture · SystemC simulation",
    dates: "Apr 2025 – May 2025",
    status: "Course project",
    summary:
      "A 16-node network-on-chip simulator in SystemC that extends a two-node course baseline into a 4×4 mesh with XY routing, five-port routers, input buffering, and wormhole output reservations. Across fifteen traffic scenarios, an automated scoreboard checks every delivered packet while the simulator compares latency and throughput under neighbour, stride, and hotspot traffic.",
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
        label: "Watch NoC Demo",
        url: "https://github.com/calebhabesh/systemc-noc#demo",
        type: "demo",
        ariaLabel: "Watch the SystemC NoC stride and hotspot traffic replay in the GitHub README (opens in new tab)",
        external: true,
      },
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
    title: "FPGA Pong",
    descriptor: "VHDL VGA Game",
    category: "Digital hardware · VHDL and VGA",
    dates: "Nov 2024 – Dec 2024",
    status: "Course project",
    summary:
      "A two-player VHDL Pong game built on a Spartan-3E FPGA, with VGA video, switch-controlled paddles, and collision logic. A 2026 refresh separates video timing, game state, and rendering, and drives every register from the 50 MHz board clock with synchronized switch inputs. GHDL testbenches check a full VGA frame along with paddle bounds, collisions, and goal resets.",
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
        label: "Watch Pong Demo",
        url: "https://github.com/calebhabesh/fpga-pong#2026-rtl-simulation",
        type: "demo",
        ariaLabel: "Watch FPGA Pong gameplay recorded from the VHDL simulation in the GitHub README (opens in new tab)",
        external: true,
      },
      {
        label: "Pong GitHub",
        url: "https://github.com/calebhabesh/fpga-pong",
        type: "github",
        ariaLabel: "FPGA Pong repository (opens in new tab)",
        external: true,
      },
    ],
  },
  {
    id: "portfolio-site",
    tone: "rose",
    title: "Portfolio Site",
    descriptor: "Interactive Web Portfolio",
    category: "Personal website · interactive frontend",
    dates: "Sept 2026 – Oct 2026",
    status: "Live",
    summary:
      "The site you are currently viewing! This portfolio brings together project write-ups, searchable technologies, and image galleries around an interactive 3D lion emblem. On wider screens, the mazes in the side margins are a live visualization of the A* pathfinding algorithm. A blueprint grid and sketched details carry through light and dark themes, with keyboard navigation and reduced-motion support.",
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
    showcase: false,
    links: [
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
