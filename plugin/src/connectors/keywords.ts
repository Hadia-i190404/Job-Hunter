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
