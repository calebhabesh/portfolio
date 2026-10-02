import React from "react";
import { motion, useIsPresent, useReducedMotion } from "motion/react";
import { projectLayoutId, projectLayoutTransition } from "../lib/project-motion";
import { type ProjectItem } from "../data/projects";
import { CometCard } from "./ui/comet-card";
import { ProjectSketch } from "./ProjectSketch";
import { TechnologyBadges } from "./TechnologyBadges";
import type { TechnologyMatches } from "../lib/technology-search";

interface ProjectCardProps {
  project: ProjectItem;
  onExpand?: (project: ProjectItem) => void;
  expanded?: boolean;
  technologyMatches?: TechnologyMatches | null;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onExpand, expanded = false, technologyMatches }) => {
  const reduceMotion = useReducedMotion();
  const present = useIsPresent();
  const sharedLayout = !reduceMotion && present;
  const previewImage = project.images?.[0];
  const imageCount = project.images?.length || 0;
  const visibleTags = [...new Set([
    ...project.tags,
    ...(project.additionalTags || []).filter(tag => technologyMatches?.has(tag)),
  ])];

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onExpand) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, .project-box-type, .project-box-summary, .project-box-tags")) {
      return;
    }
    onExpand(project);
  };

  return (
      <CometCard className="project-comet-card" rotateDepth={1.25} translateDepth={2} disabled={expanded}>
      <motion.article
        layoutId={sharedLayout ? projectLayoutId(project.id) : undefined}
        transition={{ layout: projectLayoutTransition }}
        style={{ borderRadius: 6 }}
        className="project-box project-target"
        data-project={project.id}
        inert={!present || expanded || undefined}
        aria-hidden={!present || expanded || undefined}
        onClick={handleCardClick}
      >
        <div className={`project-box-inner relative z-10${previewImage ? " has-preview" : ""}`}>
            <div className="project-box-header">
              <div className="project-box-title-group">
                <ProjectSketch projectId={project.id} />
                <motion.h3
                  layoutId={sharedLayout ? projectLayoutId(project.id, "title") : undefined}
                  layout="position"
                  transition={projectLayoutTransition}
                  className="project-box-title"
                >
                  {onExpand ? (
                    <button
                      type="button"
                      onClick={() => onExpand(project)}
                      aria-haspopup="dialog"
                    >
                      {project.title}
                    </button>
                  ) : (
                    project.title
                  )}
                </motion.h3>
              </div>

              <div className="project-box-actions">
                {project.links.map((link) => (
                  <a
                    key={link.url}
                    className="project-icon-link"
                    href={link.url}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    aria-label={link.ariaLabel || link.label}
                  >
                    {link.type === "github" ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                      </svg>
                    ) : link.type === "demo" ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                        <polygon points="8 4 20 12 8 20 8 4" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </a>
                ))}
                {onExpand && (
                  <button
                    type="button"
                    className="project-expand-button"
                    onClick={() => onExpand(project)}
                    aria-label={`Expand details for ${project.title}`}
                    title="Expand details"
                    aria-haspopup="dialog"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <motion.p layoutId={sharedLayout ? projectLayoutId(project.id, "category") : undefined} layout="position" transition={projectLayoutTransition} className="project-box-type">{project.category}</motion.p>

            <p className="project-box-summary">{project.summary}</p>

            <TechnologyBadges tags={visibleTags} matches={technologyMatches} />

            {previewImage && (
              <a
                className="project-card-preview"
                style={{
                  "--photo-stack-second": `url("${project.images?.[1]?.src || previewImage.src}")`,
                  "--photo-stack-third": `url("${project.images?.[2]?.src || previewImage.src}")`,
                } as React.CSSProperties}
                href={previewImage.src}
                aria-label={`View ${imageCount} ${imageCount === 1 ? "Image" : "Images"} for ${project.title}`}
                aria-haspopup={onExpand ? "dialog" : undefined}
                onClick={(event) => {
                  if (onExpand && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    onExpand(project);
                  }
                }}
              >
                <span className="project-card-preview-face">
                <motion.img
                  layoutId={sharedLayout ? projectLayoutId(project.id, "image") : undefined}
                  transition={projectLayoutTransition}
                  src={previewImage.src}
                  alt={previewImage.alt}
                  width={previewImage.width}
                  height={previewImage.height}
                  loading="lazy"
                  decoding="async"
                />
                <span className="project-card-preview-label" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="3" width="15" height="15" rx="2" />
                    <path d="M3 7v12a2 2 0 0 0 2 2h12M6 14l4-4 4 4 3-3 4 4" />
                    <circle cx="16" cy="7" r="1" />
                  </svg>
                  {imageCount} {imageCount === 1 ? "Image" : "Images"}
                  <span className="project-card-preview-arrow">↗</span>
                </span>
                </span>
              </a>
            )}

            {onExpand && (
              <button
                type="button"
                className="project-details-button"
                onClick={() => onExpand(project)}
                aria-label={`View Project Details for ${project.title}`}
                aria-haspopup="dialog"
              >
                <span>View Project Details</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            )}
        </div>
      </motion.article>
      </CometCard>
  );
};
