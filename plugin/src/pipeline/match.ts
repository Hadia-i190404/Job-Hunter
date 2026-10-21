// How well a job fits one of the user's searches (S1.3). Rules only: a score, a fit
// band, the reasons, and blockers that rule a job out. The verdicts it builds on
// (eligibility, scam) are per job; this part is per user.
import type { Search } from '../schema/loop.ts';
import type { Eligibility } from './eligibility.ts';
import type { Job } from './job.ts';
import { companyKey } from './text.ts';

type Fit = 'strong' | 'good' | 'stretch' | 'no';

export interface Match {
  searchId: string;
  score: number;
  fit: Fit;
  reasons: string[];
  blockers: string[];
}

type MatchJob = Pick<Job, 'title' | 'description' | 'companyKey' | 'workMode' | 'cities'> &
  Partial<Pick<Job, 'salary'>>;

// Words that mean the same thing in job titles.
const SYNONYMS: Record<string, string> = {
  developer: 'engineer',
  dev: 'engineer',
  programmer: 'engineer',
  frontend: 'front-end',
  'front end': 'front-end',
  fullstack: 'full-stack',
  'full stack': 'full-stack',
  backend: 'back-end',
  'back end': 'back-end',
  sr: 'senior',
  jr: 'junior',
  swe: 'software engineer',
};
const LEVEL_WORDS = new Set([
  'senior',
  'junior',
  'lead',
  'staff',
  'principal',
  'intern',
  'associate',
  'graduate',
  'mid',
  'level',
  'i',
  'ii',
  'iii',
]);

export function matchJob(job: MatchJob, search: Search, eligibility: Eligibility): Match {
  const reasons: string[] = [];
  const blockers = hardBlockers(job, search, eligibility);
  const title = titleScore(job.title, search.titles);
  if (title < 15) blockers.push(`Title doesn't match your roles (${search.titles.join(', ')})`);
  else reasons.push(title >= 45 ? 'Title matches your role' : 'Title is close to your role');

  const seniority = seniorityScore(job.title, search.seniority, reasons);
  const skills = skillScore(`${job.title}\n${job.description}`, search, reasons);
  const salary = salaryScore(job, search, reasons);
  let score = title + seniority + skills + salary;
  if (eligibility.verdict === 'likely') score -= 5;
  if (eligibility.verdict === 'unclear')
    reasons.push('Whether Pakistan can apply needs a closer look');
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    searchId: search.id,
    score,
    fit: blockers.length > 0 ? 'no' : band(score),
    reasons,
    blockers,
  };
}

// The best fit across all of the user's searches.
export function bestMatch(
  job: MatchJob,
  searches: readonly Search[],
  eligibility: Eligibility,
): Match | undefined {
  return searches
    .map((search) => matchJob(job, search, eligibility))
    .sort((a, b) => Number(a.fit === 'no') - Number(b.fit === 'no') || b.score - a.score)[0];
}

function hardBlockers(job: MatchJob, search: Search, eligibility: Eligibility): string[] {
  const blockers: string[] = [];
  if (eligibility.verdict === 'not-eligible')
    blockers.push(eligibility.reasons[0] ?? 'Not open to Pakistan');
  if (
    search.skipCompanies.some(
      (name) => companyKey(name) === job.companyKey && job.companyKey !== '',
    )
  ) {
    blockers.push('A company you asked to skip');
  }
  blockers.push(...placeBlockers(job, search));
  if (eligibility.nightShift && !search.nightShiftOk)
    blockers.push('Needs US hours, and you said no night shifts');
  return blockers;
}

function placeBlockers(job: MatchJob, search: Search): string[] {
  if (job.workMode === 'unknown') return [];
  if (!search.workModes.includes(job.workMode))
    return [`${job.workMode} (you want ${search.workModes.join(' or ')})`];
  const local = job.workMode !== 'remote';
  const elsewhere = job.cities.length > 0 && !job.cities.some((c) => search.cities.includes(c));
  return local && search.cities.length > 0 && elsewhere
    ? [`In ${job.cities.join(', ')} (you chose ${search.cities.join(', ')})`]
    : [];
}

// Words every engineering title shares: they count half, so "Golang Engineer" isn't a
// good match for "Frontend Engineer" just because both say "engineer".
const GENERIC = new Set(['engineer', 'software', 'specialist', 'associate', 'web', 'remote']);
const weight = (word: string): number => (GENERIC.has(word) ? 0.5 : 1);

// 0–50: weighted share of the user's title words found in the job title.
export function titleScore(jobTitle: string, titles: readonly string[]): number {
  const job = roleWords(jobTitle);
  const best = Math.max(
    0,
    ...titles.map((title) => {
      const wanted = [...roleWords(title)];
      const total = wanted.reduce((sum, word) => sum + weight(word), 0);
      if (total === 0) return 0;
      const shared = wanted
        .filter((word) => job.has(word))
        .reduce((sum, word) => sum + weight(word), 0);
      return shared / total;
    }),
  );
  return Math.round(best * 50);
}

function roleWords(title: string): Set<string> {
  let text = ` ${title.toLowerCase().replace(/[()/,|–—-]+/g, ' ')} `;
  for (const [from, to] of Object.entries(SYNONYMS)) text = text.replaceAll(` ${from} `, ` ${to} `);
  return new Set(text.split(/\s+/).filter((word) => word.length > 1 && !LEVEL_WORDS.has(word)));
}

type Level = Search['seniority'][number];

export function seniorityOf(title: string): Level {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b|\btrainee\b/.test(t)) return 'intern';
  if (/\b(junior|jr\.?|associate|graduate|entry[-\s]level|i)\b/.test(t) && !/\bii\b/.test(t))
    return 'junior';
  if (/\b(lead|staff|principal|head|architect)\b/.test(t)) return 'lead';
  if (/\b(senior|sr\.?|iii)\b/.test(t)) return 'senior';
  return 'mid';
}

const LEVELS: readonly Level[] = ['intern', 'junior', 'mid', 'senior', 'lead'];

function seniorityScore(title: string, wanted: Search['seniority'], reasons: string[]): number {
  if (wanted.length === 0) return 15;
  const level = seniorityOf(title);
  if (wanted.includes(level)) return 15;
  const distance = Math.min(
    ...wanted.map((w) => Math.abs(LEVELS.indexOf(w) - LEVELS.indexOf(level))),
  );
  reasons.push(`Looks ${level}-level (you chose ${wanted.join('/')})`);
  return distance === 1 ? 7 : 0;
}

// 0–25: must-have skills mentioned (20), nice-to-haves (5).
function skillScore(text: string, search: Search, reasons: string[]): number {
  const lower = text.toLowerCase();
  const has = (skill: string): boolean =>
    new RegExp(`(^|[^a-z0-9])${escape(skill.toLowerCase())}([^a-z0-9]|$)`).test(lower);
  const must = search.mustSkills.filter(has);
  const nice = search.niceSkills.filter(has);
  if (must.length > 0 || nice.length > 0) reasons.push(`Mentions ${[...must, ...nice].join(', ')}`);
  const mustPart =
    search.mustSkills.length === 0 ? 20 : (must.length / search.mustSkills.length) * 20;
  const nicePart =
    search.niceSkills.length === 0 ? 0 : (nice.length / search.niceSkills.length) * 5;
  return mustPart + nicePart;
}

// 0–10: meets the floor 10, unknown 5, below 0 (shown lower, never hidden: spec R2).
function salaryScore(job: MatchJob, search: Search, reasons: string[]): number {
  if (search.salaryFloor === undefined) return 5;
  if (job.salary === undefined) return 5;
  const pay =
    search.salaryFloor.currency === 'PKR' ? job.salary.pkrPerMonth.max : job.salary.usdPerMonth.max;
  if (pay >= search.salaryFloor.amount) {
    reasons.push('Pay meets your minimum');
    return 10;
  }
  reasons.push(`Pay is below your minimum (${search.salaryFloor.currency} ${String(pay)}/month)`);
  return 0;
}

function band(score: number): Fit {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'good';
  return score >= 35 ? 'stretch' : 'no';
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
