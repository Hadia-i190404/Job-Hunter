// Countries and regions as job posts write them, for deciding whether someone in
// Pakistan can take a remote job (spec R2). Lists cover what real feeds use; anything
// unrecognised stays "unclear" and goes to the Claude step.

// Lower-case aliases, matched as whole words.
const COUNTRIES: Record<string, readonly string[]> = {
  'United States': [
    'united states',
    'usa',
    'u.s.a',
    'america',
    'us-based',
    'u.s.-based',
    'nyc',
    'new york',
    'california',
    'texas',
    'florida',
    'boston',
    'seattle',
    'san francisco',
    'chicago',
    'washington dc',
  ],
  Canada: ['canada', 'canadian', 'toronto', 'vancouver', 'montreal'],
  'United Kingdom': ['united kingdom', 'england', 'scotland', 'wales', 'britain', 'london'],
  Ireland: ['ireland', 'dublin'],
  Germany: ['germany', 'berlin', 'munich'],
  France: ['france', 'paris'],
  Spain: ['spain', 'madrid', 'barcelona'],
  Portugal: ['portugal', 'lisbon'],
  Italy: ['italy'],
  Netherlands: ['netherlands', 'amsterdam'],
  Belgium: ['belgium'],
  Poland: ['poland', 'warsaw'],
  Sweden: ['sweden'],
  Norway: ['norway'],
  Denmark: ['denmark', 'copenhagen'],
  Finland: ['finland'],
  Estonia: ['estonia'],
  Austria: ['austria'],
  Switzerland: ['switzerland', 'zurich'],
  'Czech Republic': ['czech republic', 'czechia', 'prague'],
  Hungary: ['hungary'],
  Greece: ['greece'],
  Romania: ['romania'],
  Bulgaria: ['bulgaria'],
  Ukraine: ['ukraine'],
  Israel: ['israel', 'tel aviv'],
  Turkey: ['turkey', 'türkiye', 'istanbul'],
  'United Arab Emirates': ['united arab emirates', 'uae', 'dubai', 'abu dhabi'],
  'Saudi Arabia': ['saudi arabia', 'ksa', 'riyadh'],
  Qatar: ['qatar', 'doha'],
  Egypt: ['egypt', 'cairo'],
  'South Africa': ['south africa', 'cape town', 'johannesburg'],
  Nigeria: ['nigeria', 'lagos'],
  Kenya: ['kenya', 'nairobi'],
  India: [
    'india',
    'bangalore',
    'bengaluru',
    'mumbai',
    'delhi',
    'hyderabad, india',
    'pune',
    'chennai',
    'dehradun',
  ],
  'Sri Lanka': ['sri lanka'],
  Bangladesh: ['bangladesh'],
  Philippines: ['philippines', 'manila'],
  Vietnam: ['vietnam'],
  Indonesia: ['indonesia'],
  Malaysia: ['malaysia'],
  Singapore: ['singapore'],
  Japan: ['japan', 'tokyo'],
  'South Korea': ['south korea', 'korea', 'seoul'],
  China: ['china', 'beijing', 'shanghai'],
  Taiwan: ['taiwan', 'taipei'],
  'Hong Kong': ['hong kong'],
  Australia: ['australia', 'sydney', 'melbourne'],
  'New Zealand': ['new zealand'],
  Brazil: ['brazil', 'brasil'],
  Mexico: ['mexico', 'méxico'],
  Argentina: ['argentina'],
  Colombia: ['colombia'],
  Chile: ['chile'],
  Kyrgyzstan: ['kyrgyzstan'],
};

// Short codes are only trusted in capitals ("US", "UK"), because "us" is also a word.
const CODES: readonly (readonly [string, RegExp])[] = [
  ['United States', /\b(?:US|U\.S\.?|USA)\b/],
  ['United Kingdom', /\bUK\b/],
  ['European Union', /\bEU\b/],
];

// "Boston, MA", "Columbus, IN": a US state code after a comma.
const US_STATE =
  /,\s*(?:A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\b/;

export type RegionFit = 'yes' | 'likely' | 'unclear' | 'no';

// How a region named in a post relates to Pakistan.
const REGIONS: readonly (readonly [RegionFit, RegExp])[] = [
  [
    'yes',
    /\b(?:worldwide|world[-\s]?wide|global(?:ly)?|anywhere(?! in (?!pakistan|the world))|any (?:location|country)|all countries|every time ?zone|international)\b/,
  ],
  [
    'likely',
    /\b(?:apac|asia[-\s]?pacific|asia|south asia|eastern hemisphere)\b|\b(?:gmt|utc)\s*\+\s*[3-7]\b|\bpkt\b/,
  ],
  // Pakistan (UTC+5) sits at the edge of these: some employers include it, many don't.
  ['unclear', /\b(?:emea|mena|middle east|europe,? middle east,? (?:and|&) africa|cet|cest)\b/],
  [
    'no',
    /\b(?:north america|americas|latam|latin america|south america|nearshore|europe|european|dach|nordics|benelux|anz|oceania|africa)\b/,
  ],
];

export interface PlaceMentions {
  countries: string[];
  regions: RegionFit[];
}

export function findPlaces(text: string): PlaceMentions {
  const lower = text.toLowerCase();
  const countries = new Set<string>();
  for (const [country, aliases] of Object.entries(COUNTRIES)) {
    if (aliases.some((alias) => wordIn(lower, alias))) countries.add(country);
  }
  for (const [country, pattern] of CODES) if (pattern.test(text)) countries.add(country);
  if (US_STATE.test(text)) countries.add('United States');
  const regions = REGIONS.filter(([, pattern]) => pattern.test(lower)).map(([fit]) => fit);
  return { countries: [...countries], regions };
}

function wordIn(text: string, phrase: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(phrase, from);
    if (at === -1) return false;
    const before = text[at - 1] ?? ' ';
    const after = text[at + phrase.length] ?? ' ';
    if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true;
    from = at + 1;
  }
}
