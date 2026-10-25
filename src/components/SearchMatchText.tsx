import React from "react";
import type { HighlightRange } from "../lib/technology-search";

export function SearchMatchText({ text, ranges = [], format = slice => slice }: {
  text: string;
  ranges?: readonly HighlightRange[];
  format?: (slice: string) => React.ReactNode;
}) {
  const parts: React.ReactNode[] = [];
  let end = 0;
  for (const range of ranges) {
    parts.push(<React.Fragment key={`text-${end}`}>{format(text.slice(end, range.start))}</React.Fragment>);
    parts.push(<mark className="project-search-match" key={range.start}>{format(text.slice(range.start, range.end))}</mark>);
    end = range.end;
  }
  parts.push(<React.Fragment key={`text-${end}`}>{format(text.slice(end))}</React.Fragment>);
  return <>{parts}</>;
}
