// On-site, hybrid or remote, from the words a posting uses about itself.

export type WorkMode = 'onsite' | 'hybrid' | 'remote' | 'unknown';

const HYBRID =
  /\bhybrid\b|\b\d\s*days?\s*(?:a week\s*)?(?:in|at|from)\s*(?:the\s*)?office\b|\bpartially remote\b/;
const NOT_REMOTE =
  /\b(?:no|not|non)[-\s](?:an?\s+)?remote\b|\bremote (?:work )?(?:is )?not (?:available|possible|an option)\b/;
const REMOTE =
  /\bremote\b|\bremoto\b|\bhome[-\s]based\b|\bwork(?:ing)? from home\b|\bwfh\b|\banywhere\b|\bdistributed\b|\btelecommut/;
const ONSITE = /\bon[-\s]?site\b|\bin[-\s]office\b|\boffice[-\s]based\b|\bin[-\s]person\b/;

// Location text speaks for the job; the description may mention modes only in passing,
// so it's consulted only when the location and title say nothing.
export function detectWorkMode(parts: {
  location?: string;
  title?: string;
  description?: string;
  remoteFlag?: boolean;
}): WorkMode {
  const primary = `${parts.location ?? ''} ${parts.title ?? ''}`.toLowerCase();
  const fromPrimary = modeIn(primary);
  if (fromPrimary !== 'unknown') return fromPrimary;
  if (parts.remoteFlag === true) return 'remote';
  return modeIn((parts.description ?? '').toLowerCase());
}

function modeIn(text: string): WorkMode {
  if (HYBRID.test(text)) return 'hybrid';
  if (NOT_REMOTE.test(text)) return 'onsite';
  if (REMOTE.test(text)) return 'remote';
  if (ONSITE.test(text)) return 'onsite';
  return 'unknown';
}
