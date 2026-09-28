import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { projects, type ProjectItem } from "../data/projects";
import { ProjectCard } from "./ProjectCard";
import { ProjectLinkButton } from "./ProjectLinkButton";
import { ProjectGallery } from "./ProjectGallery";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { CloseIcon } from "./expandable-card-demo-standard";

export const ProjectsList: React.FC = () => {
  useEffect(() => {
    const container = document.getElementById("projects-root");
    container?.setAttribute("data-interactive", "true");
    return () => container?.removeAttribute("data-interactive");
  }, []);

  const [active, setActive] = useState<ProjectItem | null>(null);
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
      closeButtonRef.current?.focus();
    } else {
      triggerRef.current?.focus();
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
    <>
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
          <div className="project-dialog-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`dialog-title-${active.id}`}
              className="project-dialog w-full max-w-[620px] flex flex-col rounded-2xl overflow-hidden"
            >
              <div ref={scrollRef} className="project-dialog-scroll p-6 sm:p-8 flex flex-col gap-4 overflow-y-auto">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3
                        id={`dialog-title-${active.id}`}
                        className="text-2xl font-bold text-[var(--ink)] tracking-tight m-0"
                      >
                        {active.title}
                      </h3>
                    </div>
                    <p className="project-box-type m-0 text-sm font-semibold text-[var(--green)]">
                      {active.category}
                    </p>
                  </div>

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

                <p className="text-[var(--ink-soft)] text-base leading-relaxed m-0">
                  {active.summary}
                </p>

                <ul className="project-box-tags m-0 p-0" aria-label="Technologies">
                  {[...active.tags, ...(active.additionalTags || [])].map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>

                {!!active.images?.length && (
                  <ProjectGallery
                    key={active.id}
                    images={active.images}
                    projectTitle={active.title}
                  />
                )}

                <div className="pt-4 flex flex-col gap-3">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)] m-0">
                    Architecture &amp; Validation Evidence
                  </h4>
                  <div className="flex flex-col gap-3">
                    {active.evidence.map((point) => (
                      <div
                        key={point.heading}
                        className="project-evidence p-3.5 rounded-lg"
                      >
                        <strong className="text-[var(--ink)] block mb-1 text-sm font-semibold">
                          {point.heading}
                        </strong>
                        <p className="text-[var(--ink-soft)] text-sm m-0 leading-relaxed">
                          {point.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {active.links.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-3">
                    {active.links.map((link) => (
                      <ProjectLinkButton key={link.url} link={link} />
                    ))}
                  </div>
                )}
              </div>
              <div className="project-dialog-scroll-hint" data-visible={hasMoreBelow} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {projects.map((project, index) => (
        <div
          key={project.id}
          className="project-card-animate"
          data-card-index={index}
          data-direction={index % 2 === 0 ? "left" : "right"}
          // The entrance controller owns class/style/reveal attributes before
          // and after hydration. React owns the unchanged card contents.
          suppressHydrationWarning
        >
          <ProjectCard project={project} onExpand={openProject} />
        </div>
      ))}
    </>
  );
};
