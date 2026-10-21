// Can someone in Pakistan take this job? (spec R2). Rules only: what they can't decide
// comes back "unclear" with needsClaude, for the Claude step (P1). The verdict depends
// only on the job, never on the user, so it's computed once per job (CLAUDE.md).
import type { Job } from './job.ts';
import { findPlaces, type RegionFit } from './places.ts';
import { detectWorkMode } from './work-mode.ts';

export type Verdict = 'eligible' | 'likely' | 'unclear' | 'not-eligible';

export interface Eligibility {
  verdict: Verdict;
  reasons: string[];
  needsClaude: boolean;
  // Needs US working hours: a night shift from Pakistan. Users choose if that's OK.
  nightShift: boolean;
}

type JobFacts = Pick<Job, 'locationText' | 'description' | 'workMode' | 'cities' | 'inPakistan'>;

// Sentences in descriptions that restrict where people can work from.
const RESTRICTION =
  /[^.;\n]*\b(?:must (?:be|reside|live)(?: located| based)? in|(?:located|based|reside|residing) (?:in|within)|open to (?:candidates|applicants)(?: based)? in|authori[sz]ed to work in|work authori[sz]ation (?:in|for)|citizens? of|only open to|anywhere in)\b[^.;\n]*/gi;
const US_HOURS =
  /\b(?:EST|EDT|PST|PDT|CST|MST|ET|PT)\b|\b(?:US|U\.S\.)\s*(?:business |working )?(?:hours|time ?zones?)\b|\b(?:eastern|pacific|central|mountain)\s*(?:standard )?(?:time|timezones?|hours)\b|\bus central or east coast\b/i;
// Description sentences that say where the company hires (not "customers worldwide").
const HIRING_SENTENCE =
  /[^.;\n]*\b(?:location|we hire|hiring|candidates|applicants|roles? (?:can|may) be|open (?:in|to)|time ?zones? only|filled from)\b[^.;\n]*/gi;
const CONTRACTOR =
  /\b(?:independent )?contractor\b|\bdeel\b|\bemployer of record\b|\beor\b|\boyster\b|\bremote\.com\b/i;

export function assessEligibility(job: JobFacts): Eligibility {
  const restrictions = [...job.description.matchAll(RESTRICTION)].map((m) => m[0].trim());
  const nightShift = US_HOURS.test(`${job.locationText} ${job.description}`);
  const notes = nightShift ? ['Needs US working hours (a night shift in Pakistan)'] : [];
  if (CONTRACTOR.test(job.description))
    notes.push('Hires contractors or uses an Employer of Record');

  const result = isRemote(job) ? remoteVerdict(job, restrictions) : localVerdict(job);
  return {
    verdict: result.verdict,
    reasons: [...result.reasons, ...notes],
    needsClaude: result.verdict === 'unclear',
    nightShift,
  };
}

interface Outcome {
  verdict: Verdict;
  reasons: string[];
}

// Remote feeds often give only a region ("Worldwide", "LATAM") with no word "remote".
function isRemote(job: JobFacts): boolean {
  if (job.workMode === 'remote') return !namesPlaceWithoutRemote(job.locationText);
  if (job.workMode !== 'unknown' || job.cities.length > 0) return false;
  return findPlaces(job.locationText).regions.length > 0;
}

// "Atlanta, Georgia" with "remote" only somewhere in the description is an office job
// in Atlanta: the location field is the employer's own answer to "where" (found 22 Oct
// with two US-based Databricks roles).
function namesPlaceWithoutRemote(locationText: string): boolean {
  const text = locationText.trim();
  if (text === '' || detectWorkMode({ location: text }) !== 'unknown') return false;
  return findPlaces(text).regions.length === 0;
}

function localVerdict(job: JobFacts): Outcome {
  if (job.cities.length > 0) {
    const mode = job.workMode === 'hybrid' ? 'Hybrid' : 'Office';
    return { verdict: 'eligible', reasons: [`${mode} job in ${job.cities.join(', ')}`] };
  }
  if (job.inPakistan) return { verdict: 'likely', reasons: ['In Pakistan; city not stated'] };
  const { countries } = findPlaces(job.locationText);
  if (countries.length > 0) {
    return {
      verdict: 'not-eligible',
      reasons: [`On-site in ${countries.join(', ')}: relocating abroad isn't covered yet`],
    };
  }
  // Pakistani posts always name the city, so an office or hybrid job (or any named place)
  // with no Pakistani location is abroad (found 22 Oct: Cloudflare "Hybrid", MongoDB
  // "Gurugram").
  const place = job.locationText.trim();
  if (job.workMode !== 'unknown' || place !== '') {
    const where =
      place === '' || /^(hybrid|in[-\s]?office|on[-\s]?site)$/i.test(place)
        ? 'outside Pakistan'
        : `in ${place}`;
    return { verdict: 'not-eligible', reasons: [`Office or hybrid job ${where}, not in Pakistan`] };
  }
  return { verdict: 'unclear', reasons: ['Location and work mode not stated'] };
}

function remoteVerdict(job: JobFacts, restrictions: readonly string[]): Outcome {
  const restrictionText = restrictions.join('; ');
  if (/\bpakistan\b/i.test(`${job.locationText} ${restrictionText}`)) {
    return { verdict: 'eligible', reasons: ['Remote, and Pakistan is listed'] };
  }
  const fromRestrictions = findPlaces(restrictionText);
  if (fromRestrictions.countries.length > 0 && !fromRestrictions.regions.includes('yes')) {
    return {
      verdict: 'not-eligible',
      reasons: [
        `Remote, but limited to ${fromRestrictions.countries.join(', ')}: "${clip(restrictions[0] ?? '')}"`,
      ],
    };
  }
  const fromLoc = fromLocation(job.locationText);
  if (fromLoc.verdict !== 'unclear' || findPlaces(job.locationText).regions.length > 0)
    return fromLoc;
  // The location field says nothing useful; try what the description says about hiring.
  const hiring = [...job.description.matchAll(HIRING_SENTENCE)].map((m) => m[0].trim()).join('; ');
  const fromHiring = hiring === '' ? fromLoc : fromLocation(hiring);
  return fromHiring.verdict === 'not-eligible' && findPlaces(hiring).countries.length === 0
    ? fromLoc
    : fromHiring;
}

function fromLocation(locationText: string): Outcome {
  const { countries, regions } = findPlaces(locationText);
  const best = bestFit(regions);
  if (best === 'yes') return { verdict: 'eligible', reasons: ['Remote, open worldwide'] };
  if (best === 'likely')
    return { verdict: 'likely', reasons: [`Remote, region includes Pakistan: ${locationText}`] };
  if (best === 'unclear') {
    return {
      verdict: 'unclear',
      reasons: [`Remote in a region that may not include Pakistan: ${locationText}`],
    };
  }
  if (countries.length > 0 || best === 'no') {
    const where = countries.length > 0 ? countries.join(', ') : locationText;
    return { verdict: 'not-eligible', reasons: [`Remote, but only from ${where}`] };
  }
  return { verdict: 'unclear', reasons: ["Remote, but where it hires from isn't stated"] };
}

const FIT_ORDER: readonly RegionFit[] = ['yes', 'likely', 'unclear', 'no'];

function bestFit(regions: readonly RegionFit[]): RegionFit | undefined {
  return FIT_ORDER.find((fit) => regions.includes(fit));
}

function clip(text: string): string {
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
