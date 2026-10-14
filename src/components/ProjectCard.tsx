import React from "react";
import { useIsPresent } from "motion/react";
import { projects, type ProjectItem } from "../data/projects";
import { CometCard } from "./ui/comet-card";
import { ProjectSketch } from "./ProjectSketch";
import { ProjectLinkIcon } from "./ProjectLinkButton";
import { TechnologyBadges } from "./TechnologyBadges";
import type { ProjectMatches, ProjectTextMatches } from "../lib/technology-search";
import { SearchMatchText } from "./SearchMatchText";

// Matches the sheets from scripts/generate-paper-crumple.mjs and styles.css.
const CRUMPLE_VARIANTS = 8;
export function crumpleVariant(projectId: string) {
  return Math.max(0, projects.findIndex(project => project.id === projectId)) % CRUMPLE_VARIANTS;
}

interface ProjectCardProps {
  project: ProjectItem;
  onExpand?: (project: ProjectItem) => void;
  expanded?: boolean;
  matches?: ProjectMatches | null;
}

function ProjectCardLink({ project, type }: { project: ProjectItem; type: "live" | "live-demo" | "github" }) {
  const link = project.links.find(link => link.type === type);
  const label = type === "live" ? "Live Site" : type === "github" ? "GitHub" : "Live Demo";
  const icon = <ProjectLinkIcon type={type} size={18} />;
  if (!link || link.pending) {
    const description = `${label} for ${project.title} (coming soon)`;
    return (
      <button type="button" className="project-icon-link" disabled aria-label={description} title={description}>
        {icon}
      </button>
    );
  }
  return (
    <a className="project-icon-link" href={link.url}
      target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}
      aria-label={`${label}: ${link.ariaLabel}`} title={`${label} for ${project.title}`}>
      {icon}
    </a>
  );
}

export function ProjectTitle({ project, matches }: { project: ProjectItem; matches?: ProjectTextMatches }) {
  return (
    <>
      <SearchMatchText text={project.title} ranges={matches?.title} />
      <span className="project-title-separator"> — </span>
      <span className="project-title-descriptor"><SearchMatchText text={project.descriptor} ranges={matches?.descriptor} /></span>
    </>
  );
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onExpand, expanded = false, matches }) => {
  const present = useIsPresent();
  const previewImage = project.images?.[0];
  const imageCount = project.images?.length || 0;
  const visibleTags = [...new Set([
    ...project.tags,
    ...(project.additionalTags || []).filter(tag => matches?.technologies.has(tag)),
  ])];

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onExpand) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, .project-box-descriptor, .project-box-type, .project-box-summary, .project-box-tags")) {
      return;
    }
    onExpand(project);
  };

  return (
      <CometCard className="project-comet-card" rotateDepth={1.25} translateDepth={2} disabled={expanded}>
      <article
        style={{ borderRadius: 6 }}
        className="project-box project-target"
        data-project={project.id}
        data-crumple={crumpleVariant(project.id)}
        inert={!present || expanded || undefined}
        aria-hidden={!present || expanded || undefined}
        onClick={handleCardClick}
      >
        <div className={`project-box-inner relative z-10${previewImage ? " has-preview" : ""}`}>
            <div className="project-box-header">
              <div className="project-box-title-group">
                <ProjectSketch projectId={project.id} />
                <div className="project-box-title-stack">
                  <h3 className="project-box-title">
                    {onExpand ? (
                      <button
                        type="button"
                        onClick={() => onExpand(project)}
                        aria-haspopup="dialog"
                      >
                        <ProjectTitle project={project} matches={matches?.text} />
                      </button>
                    ) : (
                      <ProjectTitle project={project} matches={matches?.text} />
                    )}
                  </h3>
                  <p className="project-box-type"><SearchMatchText text={project.category} ranges={matches?.text.category} /></p>
                </div>
              </div>

              <div className="project-box-actions">
                <ProjectCardLink project={project} type={project.links.some(link => link.type === "live") ? "live" : "live-demo"} />
                <ProjectCardLink project={project} type="github" />
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
              {/* Narrow cards show the descriptor here; the heading keeps it for screen readers. */}
              <p className="project-box-descriptor" aria-hidden="true"><SearchMatchText text={project.descriptor} ranges={matches?.text.descriptor} /></p>
            </div>

            <p className="project-box-summary"><SearchMatchText text={project.summary} ranges={matches?.text.summary} /></p>

            <TechnologyBadges tags={visibleTags} matches={matches?.technologies} />

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
                <img
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
      </article>
      </CometCard>
  );
};
