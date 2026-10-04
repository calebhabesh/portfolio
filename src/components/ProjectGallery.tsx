import { useState } from "react";
import type { ProjectImage } from "../data/projects";

interface ProjectGalleryProps {
  images: ProjectImage[];
  projectTitle: string;
}

export function ProjectGallery({ images, projectTitle }: ProjectGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = images[selectedIndex];
  const moveImage = (direction: number) => {
    setSelectedIndex(index => (index + direction + images.length) % images.length);
  };

  if (!selected) return null;

  return (
    <section className="project-gallery" aria-label={`${projectTitle} gallery`}
      onKeyDown={event => {
        if (images.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          moveImage(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <div className="project-gallery-heading">
        <h4>Gallery</h4>
        {images.length > 1 && <span aria-live="polite" aria-atomic="true">{selectedIndex + 1} / {images.length}</span>}
      </div>

      <figure className="project-gallery-figure">
        <div className="project-gallery-stage">
          <img
            style={{ borderRadius: 6 }}
            key={selected.src}
            src={selected.src}
            alt={selected.alt}
            width={selected.width}
            height={selected.height}
            loading="lazy"
            decoding="async"
          />
          {images.length > 1 && (
            <>
              <button type="button" className="project-gallery-nav project-gallery-prev"
                aria-label="Previous image" onClick={() => moveImage(-1)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m14 6-6 6 6 6" />
                </svg>
              </button>
              <button type="button" className="project-gallery-nav project-gallery-next"
                aria-label="Next image" onClick={() => moveImage(1)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m10 6 6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>
        <figcaption>
          <span>{selected.caption}</span>
          <a href={selected.src} target="_blank" rel="noreferrer">
            View full image
          </a>
        </figcaption>
      </figure>

      {images.length > 1 && (
        <div className="project-gallery-thumbnails" aria-label="Choose an image">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              className="project-gallery-thumbnail"
              aria-label={`Show image ${index + 1}: ${image.caption}`}
              aria-pressed={index === selectedIndex}
              onClick={() => setSelectedIndex(index)}
            >
              <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
