// HTML → readable plain text, for job descriptions.

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  middot: '·',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X'))
      return fromCode(parseInt(code.slice(2), 16), match);
    if (code.startsWith('#')) return fromCode(parseInt(code.slice(1), 10), match);
    return NAMED[code.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>|<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function fromCode(code: number, fallback: string): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : fallback;
}
