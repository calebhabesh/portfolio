import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { projectLayoutId, projectLayoutTransition } from "../lib/project-motion";
import { projects, type ProjectItem } from "../data/projects";
import { ProjectCard } from "./ProjectCard";
import { ProjectLinkButton } from "./ProjectLinkButton";
import { ProjectGallery } from "./ProjectGallery";
import { ProjectSketch } from "./ProjectSketch";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { CloseIcon } from "./expandable-card-demo-standard";
import CardHoverEffectDemo from "./card-hover-effect-demo";
import { TechnologyBadges } from "./TechnologyBadges";
import { matchTechnologyTags, matchTechnologyText, technologySearchTerms } from "../lib/technology-search";
import { SearchMatchText } from "./SearchMatchText";
import { useProjectFilterMotion } from "../hooks/use-project-filter-motion";
import { ProjectFrameGuides } from "./ProjectFrameGuides";
import { HoverEffectItem } from "./ui/card-hover-effect";

export const ProjectsList: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    const container = document.getElementById("projects-root");
    container?.setAttribute("data-interactive", "true");
    setInteractive(true);
    return () => container?.removeAttribute("data-interactive");
  }, []);

  const [active, setActive] = useState<ProjectItem | null>(null);
  const [query, setQuery] = useState("");
  const terms = useMemo(() => technologySearchTerms(query), [query]);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const technologyMatches = useMemo(() => {
    return new Map(projects.map(project => [project.id,
      matchTechnologyTags([...project.tags, ...(project.additionalTags || [])], terms),
    ]));
  }, [terms]);
  const matchingIds = useMemo(() => new Set(projects
    .filter(project => technologyMatches.get(project.id) !== null)
    .map(project => project.id)), [technologyMatches]);
  const matchingProjects = projects.filter(project => matchingIds.has(project.id));
  const highlightText = (text: string) => <SearchMatchText text={text} ranges={active
    ? matchTechnologyText(text, [...active.tags, ...(active.additionalTags || [])], terms)
    : []} />;
  const prepareFilterMotion = useProjectFilterMotion(listRef);
  const changeQuery = (value: string) => {
    if (value === query) return;
    prepareFilterMotion();
    setQuery(value);
  };
  const clearSearch = () => {
    changeQuery("");
    searchRef.current?.focus({ preventScroll: true });
  };
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openProject = (project: ProjectItem) => {
    triggerRef.current = document.activeElement instanceof HTMLElement &&
      document.activeElement.closest(`[data-project="${project.id}"]`)
      ? document.activeElement
      : document.querySelector<HTMLElement>(`[data-project="${project.id}"] .project-expand-button`);
    setActive(project);
  };

  useEffect(() => {
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(null);
      } else if (event.key === "Tab" && modalRef.current) {
        const controls = [...modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    if (active) {
      root.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus({ preventScroll: true });
    } else {
      triggerRef.current?.focus({ preventScroll: true });
      triggerRef.current = null;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [active]);

  useOutsideClick(modalRef, () => setActive(null));

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!active || !scroll) {
      setHasMoreBelow(false);
      return;
    }

    const updateScrollHint = () => {
      setHasMoreBelow(scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 2);
    };
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(scroll);
    for (const child of scroll.children) observer.observe(child);
    scroll.addEventListener("scroll", updateScrollHint, { passive: true });
    updateScrollHint();
    return () => {
      observer.disconnect();
      scroll.removeEventListener("scroll", updateScrollHint);
    };
  }, [active]);

  return (
    <LayoutGroup id="portfolio-projects">
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 bg-black/55 h-full w-full z-50 pointer-events-none"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active ? (
          <motion.div layoutRoot className="project-dialog-overlay" key={active.id}>
            <motion.div
              layoutId={reduceMotion ? undefined : projectLayoutId(active.id)}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ layout: projectLayoutTransition, opacity: { duration: reduceMotion ? 0 : 0.16 } }}
              style={{ borderRadius: 16 }}
              ref={modalRef}
              role="dialog"
              data-project-tone={active.tone}
              aria-modal="true"
              aria-labelledby={`dialog-title-${active.id}`}
              className="project-dialog w-full max-w-[900px] flex flex-col rounded-2xl overflow-hidden"
            >
              <motion.div layout className="project-dialog-header">
                <div className="flex flex-col gap-1.5">
                  <div className="project-box-title-group">
                    <ProjectSketch projectId={active.id} />
                    <motion.h3
                      layoutId={reduceMotion ? undefined : projectLayoutId(active.id, "title")}
                      layout="position"
                      transition={projectLayoutTransition}
                      id={`dialog-title-${active.id}`}
                      className="text-2xl font-bold text-[var(--ink)] tracking-tight m-0"
                    >
                      {active.title}
                    </motion.h3>
                  </div>
                  <motion.p layoutId={reduceMotion ? undefined : projectLayoutId(active.id, "category")} layout="position" transition={projectLayoutTransition} className="project-box-type m-0 text-sm font-semibold text-[var(--green)]">
                    {active.category}
                  </motion.p>
                </div>

                <div className="project-dialog-actions">
                  {active.links.map((link) => (
                    <ProjectLinkButton key={link.url} link={link} />
                  ))}
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="project-dialog-close flex items-center justify-center p-2 rounded-full border-0 transition-colors shrink-0 cursor-pointer"
                    onClick={() => setActive(null)}
                    aria-label="Close dialog"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </motion.div>

              <motion.div layout layoutScroll ref={scrollRef} className="project-dialog-scroll px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col gap-4 overflow-y-auto">

                <p className="project-dialog-summary text-[var(--ink-soft)] text-base leading-relaxed m-0">
                  {highlightText(active.summary)}
                </p>

                <TechnologyBadges tags={[...active.tags, ...(active.additionalTags || [])]} matches={technologyMatches.get(active.id)} />

                {!!active.images?.length && (
                  <ProjectGallery
                    key={active.id}
                    images={active.images}
                    projectTitle={active.title}
                    imageLayoutId={projectLayoutId(active.id, "image")}
                  />
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)] m-0">
                    Project Notes
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {active.evidence.map((point) => (
                      <div
                        key={point.heading}
                        className="project-evidence p-3.5 rounded-lg"
                      >
                        <strong className="text-[var(--ink)] block mb-1 text-sm font-semibold">
                          {highlightText(point.heading)}
                        </strong>
                        <p className="text-[var(--ink-soft)] text-sm m-0 leading-relaxed">
                          {highlightText(point.detail)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
              <div className="project-dialog-scroll-hint" data-visible={hasMoreBelow} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="section-header project-section-header">
        <h2 id="work-title" className="section-title">Selected Projects</h2>
        <form className="project-search" role="search" aria-label="Search project technologies" onSubmit={event => event.preventDefault()}>
          <div className="project-search-field">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              ref={searchRef}
              id="project-technology-search"
              type="search"
              value={query}
              onChange={event => changeQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Escape" && query) {
                  event.preventDefault();
                  event.stopPropagation();
                  clearSearch();
                }
              }}
              placeholder="Search projects or technologies..."
              aria-label="Search technologies"
              aria-controls="project-search-results"
              disabled={!interactive}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="project-search-clear" onClick={clearSearch} aria-label="Clear technology search" hidden={!query}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {query.trim() ? `${matchingIds.size} of ${projects.length} projects` : `${projects.length} projects`}
          </span>
        </form>
      </div>

      <div ref={listRef} id="project-search-results" className="project-search-results" data-filtering={Boolean(query.trim())}>
        <CardHoverEffectDemo disabled={Boolean(active)}>
          {projects.map((frameProject, index) => {
            const project = matchingProjects[index];
            return (
              <div
                key={frameProject.id}
                className="project-card-animate"
                data-card-index={index}
                data-direction={index % 2 === 0 ? "left" : "right"}
                data-search-match={Boolean(project)}
                data-result-id={project?.id}
                // The entrance controller mutates these stable frame shells.
                suppressHydrationWarning
              >
                <HoverEffectItem
                  itemId={project?.id || frameProject.id}
                  className="project-frame"
                  data-project-tone={project?.tone}
                  data-expanded={Boolean(project && active?.id === project.id) || undefined}
                  inert={Boolean(project && active?.id === project.id) || undefined}
                >
                  <ProjectFrameGuides projectId={frameProject.id} />
                  <AnimatePresence initial={false} mode="wait">
                    {project ? (
                      <motion.div
                        key={project.id}
                        className="project-slot-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                        inert={active?.id === project.id || undefined}
                        aria-hidden={active?.id === project.id || undefined}
                        onAnimationComplete={() => window.dispatchEvent(new Event("portfolio:project-filter"))}
                      >
                        <ProjectCard
                          project={project}
                          onExpand={openProject}
                          expanded={active?.id === project.id}
                          technologyMatches={technologyMatches.get(project.id)}
                        />
                      </motion.div>
                    ) : index === 0 && (
                      <motion.div
                        key="empty"
                        className="project-search-empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                      >
                        <div className="project-search-empty-message">
                          <p className="project-search-empty-title">No matching projects.</p>
                          <p>Try another technology, or <a href="https://github.com/calebhabesh" target="_blank" rel="noreferrer">
                            browse my GitHub
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M7 17 17 7M7 7h10v10" />
                            </svg>
                          </a></p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </HoverEffectItem>
              </div>
            );
          })}
        </CardHoverEffectDemo>
      </div>
    </LayoutGroup>
  );
};
