import React from "react";
import type { HighlightRange } from "../lib/technology-search";

export function SearchMatchText({ text, ranges = [] }: { text: string; ranges?: readonly HighlightRange[] }) {
  const parts: React.ReactNode[] = [];
  let end = 0;
  for (const range of ranges) {
    parts.push(text.slice(end, range.start));
    parts.push(<mark className="project-search-match" key={range.start}>{text.slice(range.start, range.end)}</mark>);
    end = range.end;
  }
  parts.push(text.slice(end));
  return <>{parts}</>;
}
