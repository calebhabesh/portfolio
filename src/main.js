import "./styles.css";
import "./projects-island.tsx";

const EMBLEM_MODEL_URL = new URL("../lion_emblem.optimized.glb", import.meta.url).href;
const EMBLEM_COLLISION_FIELD_URL = new URL("../emblem-collision-field.bin", import.meta.url).href;

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
  return response.arrayBuffer();
}

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
  themeColor?.setAttribute("content", theme === "dark" ? "#111713" : "#f6f5f0");

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
  const modelBufferPromise = fetchAssetBuffer(EMBLEM_MODEL_URL, "The emblem model");
  const collisionFieldBufferPromise = fetchAssetBuffer(
    EMBLEM_COLLISION_FIELD_URL,
    "The emblem collision field",
  );

  stage.dataset.modelState = "loading";
  const status = stage.querySelector("[data-emblem-status]");
  if (status && status.lastChild) {
    status.lastChild.textContent = " Loading emblem";
  }

  return emblemSceneModulePromise
    .then(async ({ initEmblemScene }) => {
      const sceneInstance = await initEmblemScene(stage, {
        startedAt,
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
      if (status && status.lastChild) {
        status.lastChild.textContent = " 3D unavailable";
        status.title = error?.message || "WebGL could not be initialized";
      }
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
