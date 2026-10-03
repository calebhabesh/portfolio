import "./styles.css";
import { entranceSelector, projectEntranceReady } from "./project-entrance.js";
import { initBlueprintGrid } from "./blueprint-grid.js";

const disposeBlueprintGrid = initBlueprintGrid();
if (import.meta.hot) import.meta.hot.dispose(() => disposeBlueprintGrid?.());

let disposeGutterMazes;
let backgroundDisposed = false;
import("./gutter-maze.js").then(({ initGutterMazes }) => {
  if (!backgroundDisposed) disposeGutterMazes = initGutterMazes();
}).catch(error => console.error("The gutter mazes could not start.", error));
if (import.meta.hot) import.meta.hot.dispose(() => {
  backgroundDisposed = true;
  disposeGutterMazes?.();
});

const EMBLEM_MODEL_URL = new URL("./assets/lion_emblem.optimized.glb.gzip", import.meta.url).href;
const EMBLEM_COLLISION_FIELD_URL = new URL("./assets/emblem-collision-field.bin.gzip", import.meta.url).href;

async function fetchAssetBuffer(url, label) {
  let response;
  try {
    response = await fetch(url, { cache: "force-cache" });
  } catch {
    response = await fetch(url);
  }
  if (!response.ok) {
    try {
      response = await fetch(url);
    } catch {
      // Keep earlier response
    }
  }
  if (!response || !response.ok) {
    throw new Error(`${label} failed to load (${response?.status || "network error"}).`);
  }
  return new Response(
    response.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
}

let initialModelBufferPromise = fetchAssetBuffer(EMBLEM_MODEL_URL, "The emblem model");
let initialCollisionFieldBufferPromise = fetchAssetBuffer(
  EMBLEM_COLLISION_FIELD_URL,
  "The emblem collision field",
);

const emblemTextureUrls = import.meta.glob("./assets/emblem-textures/*.webp", {
  eager: true, query: "?url", import: "default",
});
const textureImagesPromise = Promise.all(Object.entries(emblemTextureUrls).map(async ([path, url]) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return [path.split("/").at(-1).replace(".webp", ""), image];
})).then(Object.fromEntries);

const emblemSceneModulePromise = import("./emblem-scene.js");
import("./headshot-island.tsx").catch((error) => {
  console.error("The headshot hover could not start.", error);
});
import("./technology-loop-island.jsx").catch((error) => {
  console.error("The technology logo loop could not start.", error);
});
import("./background-boxes-island.tsx").catch((error) => {
  console.error("The grid pointer trail could not start.", error);
});
// Hydrate the static cards during asset download so React and Motion setup
// cannot interrupt the emblem's first spinning frames.
let projectInteractionsTimeout;
const projectInteractionsReady = Promise.race([
  import("./projects-island.tsx")
    .then(({ projectInteractionsReady }) => projectInteractionsReady)
    .catch((error) => {
      console.error("The project interactions could not start.", error);
    }),
  // The emblem remains usable if the optional project island stalls.
  new Promise((resolve) => { projectInteractionsTimeout = setTimeout(resolve, 3000); }),
]).finally(() => clearTimeout(projectInteractionsTimeout));

const root = document.documentElement;

const themeToggle = document.querySelector("[data-theme-toggle]");
const themeColor = document.querySelector('meta[name="theme-color"]');
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function readSavedTheme() {
  try {
    return localStorage.getItem("caleb-portfolio-theme");
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("caleb-portfolio-theme", theme);
  } catch {
    // The chosen theme still applies for this visit when storage is unavailable.
  }
}

function applyTheme(theme, persist = false) {
  root.dataset.theme = theme;
  themeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
  themeColor?.setAttribute("content", theme === "dark" ? "#111613" : "#f7f6f2");

  if (persist) saveTheme(theme);
  window.dispatchEvent(new CustomEvent("portfolio:theme", { detail: { theme } }));
}

const savedTheme = readSavedTheme();
applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemTheme.matches ? "dark" : "light");

themeToggle?.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
});

systemTheme.addEventListener("change", (event) => {
  if (!readSavedTheme()) applyTheme(event.matches ? "dark" : "light");
});

const currentYearEl = document.querySelector("[data-current-year]");
if (currentYearEl) currentYearEl.textContent = String(new Date().getFullYear());

// Only sections below the initial viewport need scroll-triggered motion.
// Visible content keeps its CSS entrance, and no-JS or reduced-motion visits
// keep the complete page readable without waiting for an observer.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const scrollRevealTargets = [
    document.querySelector(".section-header"),
    document.querySelector(".site-footer"),
  ].filter((element) => element?.getBoundingClientRect().top >= window.innerHeight);

  const scrollRevealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.contentReveal = "visible";
      scrollRevealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.1 });

  scrollRevealTargets.forEach((element) => {
    element.dataset.contentReveal = "pending";
    scrollRevealObserver.observe(element);
    element.addEventListener("focusin", () => {
      element.dataset.contentReveal = "visible";
      scrollRevealObserver.unobserve(element);
    }, { once: true });
  });
}

let activeEmblemScene = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try {
      activeEmblemScene?.dispose?.();
    } catch (error) {
      console.warn("Could not dispose previous emblem scene:", error);
    }
    activeEmblemScene = null;
  });
}

function startEmblemScene() {
  const stage = document.querySelector("[data-emblem-stage]");
  if (!stage) return;

  if (window.__calebActiveEmblemScene?.dispose) {
    try {
      window.__calebActiveEmblemScene.dispose();
    } catch {
      // ignore
    }
    window.__calebActiveEmblemScene = null;
  }

  const startedAt = performance.now();
  const modelBufferPromise = initialModelBufferPromise || fetchAssetBuffer(EMBLEM_MODEL_URL, "The emblem model");
  const collisionFieldBufferPromise = initialCollisionFieldBufferPromise || fetchAssetBuffer(
    EMBLEM_COLLISION_FIELD_URL,
    "The emblem collision field",
  );
  initialModelBufferPromise = null;
  initialCollisionFieldBufferPromise = null;

  stage.dataset.modelState = "loading";
  delete stage.dataset.rendered;
  delete stage.dataset.motionPrimed;
  delete stage.dataset.motionStartOrientation;

  // Observe every asset promise immediately, including failures that arrive
  // before the scene module. Reserve GPU preparation only after downloads end.
  return Promise.all([
    emblemSceneModulePromise, modelBufferPromise, collisionFieldBufferPromise, textureImagesPromise,
  ])
    .then(async ([{ initEmblemScene }]) => {
      await projectInteractionsReady;
      // Prepare the invisible scene while any card entrances continue.
      stage.dataset.preparing = "true";
      const sceneInstance = await initEmblemScene(stage, {
        startedAt,
        textureImagesPromise,
        modelBufferPromise,
        collisionFieldBufferPromise,
      });
      activeEmblemScene = sceneInstance;
      window.__calebActiveEmblemScene = sceneInstance;
      return sceneInstance;
    })
    .catch((error) => {
      console.error("The interactive emblem could not start.", error);
      stage.dataset.modelState = "error";
      stage.dataset.errorMessage = error?.message || String(error);
    }).finally(() => {
      delete stage.dataset.preparing;
    });
}

const stage = document.querySelector("[data-emblem-stage]");
if (stage) {
  startEmblemScene();
  stage.addEventListener("click", (event) => {
    if (stage.dataset.modelState === "error") {
      event.preventDefault();
      startEmblemScene();
    }
  });
}

const projectsScrollArrow = document.querySelector("[data-projects-scroll-arrow]");
const projectsSection = document.querySelector("#work") || document.querySelector("#projects-root");

if (projectsScrollArrow && projectsSection) {
  const getCards = () => [
    ...projectsSection.querySelectorAll(".project-target, .project-box"),
  ].filter(card => card.closest(entranceSelector)?.dataset.searchMatch !== "false");

  const updateProjectsScrollCue = () => {
    const cards = getCards();
    if (!cards.length) {
      projectsScrollArrow.classList.add("is-hidden");
      return;
    }
    const lastCard = cards[cards.length - 1];
    const lastRect = lastCard.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const hasMore = lastRect.bottom > windowHeight + 30;
    projectsScrollArrow.classList.toggle("is-hidden", !hasMore);
  };

  projectsScrollArrow.addEventListener("click", () => {
    const cards = getCards();
    const nextCard = cards.find((card) => {
      const rect = card.getBoundingClientRect();
      return rect.top > 80;
    });

    if (nextCard) {
      nextCard.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  });

  window.addEventListener("scroll", updateProjectsScrollCue, { passive: true });
  window.addEventListener("resize", updateProjectsScrollCue, { passive: true });
  window.addEventListener("portfolio:project-filter", updateProjectsScrollCue);
  const projectsObserver = new ResizeObserver(updateProjectsScrollCue);
  projectsObserver.observe(projectsSection);
  updateProjectsScrollCue();
}

// Reveal visible cards in document order; each new viewport batch gets a
// fresh stagger so below-fold content never waits for a page-wide delay.
const revealTargets = [...document.querySelectorAll(entranceSelector)];
const cardMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
revealTargets.forEach((card) => {
  card.dataset.cardReveal = cardMotionPreference.matches ? "settled" : "pending";
  card.addEventListener("animationend", (event) => {
    if (event.target === card.querySelector(".project-comet-card") && event.animationName === "project-fly-in") {
      requestAnimationFrame(() => {
        card.dataset.cardReveal = "settled";
      });
    }
  });
});
// A changed motion preference must also release the pending interaction state.
cardMotionPreference.addEventListener("change", (event) => {
  if (event.matches) revealTargets.forEach((card) => { card.dataset.cardReveal = "settled"; });
});
const revealObserver = new IntersectionObserver((entries) => {
  const intersecting = new Set(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
  projectEntranceReady.then(() => {
    const visibleCards = revealTargets.filter((card) => {
      if (!intersecting.has(card) || !card.isConnected || card.hidden || card.dataset.searchMatch === "false" || card.classList.contains("is-visible")) return false;
      const bounds = card.getBoundingClientRect();
      return bounds.top < window.innerHeight - 30 && bounds.bottom > 0;
    });
    visibleCards.forEach((card, order) => {
      card.style.setProperty("--reveal-delay", `${order * 60}ms`);
      card.classList.add("is-visible");
      revealObserver.unobserve(card);
    });
  });
}, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
revealTargets.forEach((card) => revealObserver.observe(card));

// Keyboard navigation should never land on an invisible control.
document.addEventListener("focusin", (event) => {
  const card = event.target.closest?.(entranceSelector);
  if (!card) return;
  card.dataset.cardReveal = "settled";
  card.classList.add("is-visible");
  revealObserver.unobserve(card);
});
