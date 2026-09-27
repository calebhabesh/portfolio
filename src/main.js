import "./styles.css";
import { projectEntranceReady, waitForProjectEntrances } from "./project-entrance.js";

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

  // Observe every asset promise immediately, including failures that arrive
  // before the scene module. Reserve GPU preparation only after downloads end.
  return Promise.all([
    emblemSceneModulePromise, modelBufferPromise, collisionFieldBufferPromise, textureImagesPromise,
  ])
    .then(async ([{ initEmblemScene }]) => {
      // A late model must not interrupt entrances released by the fallback.
      await waitForProjectEntrances();
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
  ];

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
  const projectsObserver = new ResizeObserver(updateProjectsScrollCue);
  projectsObserver.observe(projectsSection);
  updateProjectsScrollCue();
}

// The static shells own entrances for their entire lifetime, including after React loads.
document.querySelectorAll(".project-card-animate").forEach((card) => {
  card.addEventListener("animationend", (event) => {
    if (event.target === card && event.animationName === "project-fly-in") {
      requestAnimationFrame(() => {
        card.dataset.cardReveal = "settled";
      });
    }
  });
});
const cardObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const card = entry.target;
    projectEntranceReady.then(() => {
      if (!card.isConnected || card.classList.contains("is-visible")) return;
      const bounds = card.getBoundingClientRect();
      if (bounds.top >= window.innerHeight - 30 || bounds.bottom <= 0) return;
      const index = Number(card.dataset.cardIndex);
      card.style.animationDelay = `${(index % 2) * 100}ms`;
      card.classList.add("is-visible");
      cardObserver.unobserve(card);
    });
  }
}, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
document.querySelectorAll(".project-card-animate").forEach((card) => cardObserver.observe(card));

// Static project content is already in the HTML; hydrate independently of the hero.
import("./projects-island.tsx").catch((error) => {
  console.error("The project interactions could not start.", error);
});
