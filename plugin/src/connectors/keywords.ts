// "react developer" matches "Senior React Developer (Remote)" but not "React Native Lead".
export function titleMatches(title: string, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return true;
  const words = new Set(tokens(title));
  return keywords.some((phrase) => {
    const wanted = tokens(phrase);
    return wanted.length > 0 && wanted.every((word) => words.has(word));
  });
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((word) => word.replace(/\.+$/, ''))
    .filter(Boolean);
}

const VARIANTS: readonly (readonly [RegExp, string])[] = [
  [/\bdeveloper\b/i, 'engineer'],
  [/\bengineer\b/i, 'developer'],
  [/\bfront[-\s]?end\b/i, 'frontend'],
  [/\bfrontend\b/i, 'front end'],
  [/\bfull[-\s]?stack\b/i, 'fullstack'],
  [/\bfullstack\b/i, 'full stack'],
  [/\bback[-\s]?end\b/i, 'backend'],
];

// The user's titles plus the obvious spellings sites use, for sources that filter by title.
export function expandTitles(titles: readonly string[]): string[] {
  const out = new Set(titles.map((t) => t.trim()).filter(Boolean));
  for (const title of [...out]) {
    for (const [pattern, replacement] of VARIANTS) {
      if (pattern.test(title)) out.add(title.replace(pattern, replacement));
    }
  }
  return [...out];
}
