export interface HighlightRange {
  start: number;
  end: number;
}

export type TechnologyMatches = Map<string, HighlightRange[]>;

// Aliases identify the same technology; they never add technologies to a stack.
const aliases: Record<string, string[]> = {
  postgresql: ["postgres"],
  typescript: ["ts"],
  javascript: ["js"],
  nextjs: ["next"],
  go: ["golang"],
  "c++": ["cpp", "cplusplus"],
  "c++17": ["c++", "cpp", "cplusplus"],
  oraclecloudinfrastructure: ["oci", "oracle cloud"],
  mutualtls: ["mtls"],
  scikitlearn: ["sklearn"],
  githubactions: ["gh actions"],
  raspberrypi4b: ["raspberry pi", "rpi"],
  aws: ["amazon web services"],
  pwa: ["progressive web app"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[.\s_-]/g, "");
}

export function technologySearchTerms(query: string) {
  return [...new Set(query.split(",").map(term => term.trim().toLowerCase()).filter(Boolean))];
}

// Optimal string alignment counts an adjacent transposition as one typo.
function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, i) =>
    Array.from({ length: right.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0),
  );
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1]),
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[left.length][right.length];
}

function matchTag(tag: string, term: string): HighlightRange[] {
  const query = normalize(term);
  if (!query) return [];
  const ranges: HighlightRange[] = [];
  // Compound display badges remain intact. Qualifiers are displayed but are
  // not searchable technologies (for example, the "Lab" in "AWS (Lab)").
  for (const segment of tag.matchAll(/[^·/]+/g)) {
    const raw = segment[0];
    const name = raw.replace(/\s*\([^)]*\)/g, "").trim();
    if (!name) continue;
    const start = segment.index! + raw.indexOf(name);
    const canonical = normalize(name);
    const names = [canonical, ...(aliases[canonical] || []).map(normalize)];
    // Short technology names and aliases must not match arbitrary substrings.
    // Other short queries can start a name, such as "J" or "Ja" for "Java".
    const exactOnly = ["c", "go", "ts", "js", "sql"].includes(query);
    const exact = names.includes(query);
    const fragment = !exactOnly && (query.length <= 2 ? canonical.startsWith(query) : canonical.includes(query));
    const tolerance = query.length >= 8 ? 2 : query.length >= 5 ? 1 : 0;
    const fuzzy = !exact && !fragment && tolerance > 0 && names.some(candidate =>
      Math.abs(candidate.length - query.length) <= tolerance &&
      editDistance(candidate, query) <= tolerance &&
      tolerance / Math.max(candidate.length, query.length) <= 0.25,
    );
    if (!exact && !fragment && !fuzzy) continue;
    const literal = name.toLowerCase().indexOf(term);
    ranges.push(literal >= 0
      ? { start: start + literal, end: start + literal + term.length }
      : { start, end: start + name.length });
  }
  return ranges;
}

export function matchTechnologyTags(tags: readonly string[], terms: readonly string[]): TechnologyMatches | null {
  const matches: TechnologyMatches = new Map();
  for (const term of terms) {
    let found = false;
    for (const tag of tags) {
      const ranges = matchTag(tag, term);
      if (!ranges.length) continue;
      found = true;
      matches.set(tag, [...(matches.get(tag) || []), ...ranges]);
    }
    if (!found) return null;
  }
  // Merge overlapping highlights when two terms match the same badge.
  for (const [tag, ranges] of matches) {
    matches.set(tag, mergeHighlightRanges(ranges));
  }
  return matches;
}

function mergeHighlightRanges(ranges: HighlightRange[]) {
  const merged: HighlightRange[] = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

// Highlight mentions of the matched technologies, rather than unrelated prose
// that happens to contain a short query. Each passage can match any search term.
export function matchTechnologyText(text: string, tags: readonly string[], terms: readonly string[]): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  for (const tag of tags) {
    for (const segment of tag.split(/[·/]/)) {
      const name = segment.replace(/\s*\([^)]*\)/g, "").trim();
      if (!name) continue;
      const matchingTerms = terms.filter(term => matchTag(name, term).length);
      if (!matchingTerms.length) continue;
      for (const spelling of [name, ...(aliases[normalize(name)] || [])]) {
        const pattern = spelling.split(/[.\s_-]+/)
          .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[.\\s_-]*");
        const mentions = new RegExp(`(?<![\\p{L}\\p{N}+#])${pattern}(?![\\p{L}\\p{N}+#])`, "giu");
        for (const mention of text.matchAll(mentions)) {
          for (const term of matchingTerms) {
            const literal = mention[0].toLowerCase().indexOf(term);
            const start = mention.index! + Math.max(0, literal);
            ranges.push({ start, end: start + (literal >= 0 ? term.length : mention[0].length) });
          }
        }
      }
    }
  }
  return mergeHighlightRanges(ranges);
}
