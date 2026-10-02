import React from "react";
import type { TechnologyMatches } from "../lib/technology-search";
import { SearchMatchText } from "./SearchMatchText";

export function TechnologyBadges({ tags, matches }: { tags: readonly string[]; matches?: TechnologyMatches | null }) {
  return (
    <ul className="project-box-tags" aria-label="Technologies">
      {tags.map(tag => {
        const ranges = matches?.get(tag) || [];
        return <li key={tag} data-search-highlight={ranges.length ? "true" : undefined}>
          <SearchMatchText text={tag} ranges={ranges} />
        </li>;
      })}
    </ul>
  );
}
