// Pakistani cities in free-text locations ("Lahore (Hybrid)", "Isb/Rwp", "Karachi, PK").
// Spec R2: on-site and hybrid jobs count only when they're in a city the user works in.

export const PK_CITIES = {
  karachi: ['karachi', 'khi'],
  lahore: ['lahore', 'lhr'],
  islamabad: ['islamabad', 'isb', 'islamabad capital territory'],
  rawalpindi: ['rawalpindi', 'rwp', 'pindi'],
  faisalabad: ['faisalabad', 'fsd', 'lyallpur'],
  multan: ['multan'],
  peshawar: ['peshawar', 'pew'],
  quetta: ['quetta'],
  hyderabad: ['hyderabad'],
  sialkot: ['sialkot'],
  gujranwala: ['gujranwala'],
  sargodha: ['sargodha'],
  bahawalpur: ['bahawalpur'],
  sukkur: ['sukkur'],
  abbottabad: ['abbottabad', 'abbotabad'],
  mardan: ['mardan'],
  gujrat: ['gujrat'],
  sheikhupura: ['sheikhupura'],
  'rahim-yar-khan': ['rahim yar khan', 'rahimyar khan', 'ryk'],
  larkana: ['larkana'],
  mirpur: ['mirpur'],
  muzaffarabad: ['muzaffarabad'],
  gilgit: ['gilgit'],
  wah: ['wah cantt', 'wah cantonment', 'wah'],
  taxila: ['taxila'],
  sahiwal: ['sahiwal'],
  jhelum: ['jhelum'],
  'dera-ghazi-khan': ['dera ghazi khan', 'd.g. khan', 'dg khan'],
  'dera-ismail-khan': ['dera ismail khan', 'd.i. khan', 'di khan'],
  nawabshah: ['nawabshah', 'shaheed benazirabad'],
  gwadar: ['gwadar'],
} as const;

type PkCity = keyof typeof PK_CITIES;

export interface PlaceMatch {
  cities: PkCity[];
  // True when the text names Pakistan or a Pakistani city.
  inPakistan: boolean;
}

const PAKISTAN = /\b(pakistan|pakistani|pk|pak)\b/;
const NOT_PAKISTAN_HYDERABAD = /\b(india|telangana|andhra|ind)\b/;
// Aliases short enough to be ordinary words or other places need the country nearby.
const NEEDS_CONTEXT: ReadonlySet<string> = new Set(['wah', 'pew', 'gujrat', 'mirpur']);
// "Twin cities" is how Pakistani posts say Islamabad + Rawalpindi.
const TWIN_CITIES = /\btwin cities\b/;

const ALIAS_PATTERNS: readonly (readonly [PkCity, string, RegExp])[] = Object.entries(
  PK_CITIES,
).flatMap(([city, aliases]) =>
  aliases.map(
    (alias) => [city as PkCity, alias, new RegExp(`(^|[^a-z])${escape(alias)}([^a-z]|$)`)] as const,
  ),
);

export function matchPlace(text: string): PlaceMatch {
  const lower = text.toLowerCase();
  const mentionsPakistan = PAKISTAN.test(lower);
  const cities = new Set<PkCity>();
  for (const [city, alias, pattern] of ALIAS_PATTERNS) {
    if (!pattern.test(lower)) continue;
    if (NEEDS_CONTEXT.has(alias) && !mentionsPakistan) continue;
    if (city === 'hyderabad' && !isPakistaniHyderabad(lower, mentionsPakistan)) continue;
    cities.add(city);
  }
  if (TWIN_CITIES.test(lower) && (mentionsPakistan || cities.size > 0)) {
    cities.add('islamabad').add('rawalpindi');
  }
  return { cities: [...cities], inPakistan: mentionsPakistan || cities.size > 0 };
}

// Hyderabad is also a big Indian tech hub: count it only with Pakistani context.
function isPakistaniHyderabad(lower: string, mentionsPakistan: boolean): boolean {
  if (NOT_PAKISTAN_HYDERABAD.test(lower)) return false;
  return mentionsPakistan || /\bsindh\b/.test(lower);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
