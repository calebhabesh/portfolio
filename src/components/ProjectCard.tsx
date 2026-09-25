import React from "react";
import { type ProjectItem } from "../data/projects";
import { CometCard } from "./ui/comet-card";

interface ProjectCardProps {
  project: ProjectItem;
  onExpand?: (project: ProjectItem) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onExpand }) => {
  const primaryLink = project.links[0] || null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onExpand) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, summary, details")) {
      return;
    }
    onExpand(project);
  };

  return (
    <CometCard className="project-comet-card" rotateDepth={1.25} translateDepth={2}>
      <article
        className="project-box project-target overflow-hidden"
        data-project={project.id}
        onClick={handleCardClick}
      >
        <div className="project-box-inner relative z-10">
            <div className="project-box-header">
              <div className="project-box-title-group">
                <h3
                  className="project-box-title"
                >
                  {primaryLink ? (
                    <a
                      href={primaryLink.url}
                      target={primaryLink.external ? "_blank" : undefined}
                      rel={primaryLink.external ? "noreferrer" : undefined}
                    >
                      {project.title}
                    </a>
                  ) : (
                    project.title
                  )}
                </h3>
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

            <p className="project-box-type">{project.category}</p>

            <p className="project-box-summary">{project.summary}</p>

            <ul className="project-box-tags" aria-label="Technologies">
              {project.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>

            <details className="project-notes">
              <summary>
                <span>Notes</span>
                <span className="plus-icon" aria-hidden="true">+</span>
              </summary>
              <div className="notes-body">
                {project.evidence.map((point) => (
                  <p key={point.heading}>
                    <strong>{point.heading}:</strong> {point.detail}
                  </p>
                ))}
                {project.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                  >
                    {link.type === "github"
                      ? "View source on GitHub"
                      : link.label}
                  </a>
                ))}
              </div>
            </details>
        </div>
      </article>
    </CometCard>
  );
};
