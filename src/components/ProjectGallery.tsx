import { useState } from "react";
import type { ProjectImage } from "../data/projects";

interface ProjectGalleryProps {
  images: ProjectImage[];
  projectTitle: string;
}

export function ProjectGallery({ images, projectTitle }: ProjectGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = images[selectedIndex];

  if (!selected) return null;

  return (
    <section className="project-gallery" aria-label={`${projectTitle} gallery`}>
      <div className="project-gallery-heading">
        <h4>Gallery</h4>
        {images.length > 1 && <span>{selectedIndex + 1} / {images.length}</span>}
      </div>

      <figure className="project-gallery-figure">
        <div className="project-gallery-stage">
          <img
            key={selected.src}
            src={selected.src}
            alt={selected.alt}
            width={selected.width}
            height={selected.height}
            loading="lazy"
            decoding="async"
          />
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
