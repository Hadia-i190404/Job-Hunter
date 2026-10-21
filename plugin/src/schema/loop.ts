// Data for the daily loop (Slice 1): what the user is looking for, answers they've given
// once, gaps already asked about, and the applications Job Hunter prepares (D20, D21).
import {
  arrayOf,
  boolean,
  isoDate,
  number,
  object,
  oneOf,
  optional,
  string,
  type Infer,
} from './core.ts';

const id = string({ pattern: /^[a-z][a-z0-9-]{0,60}$/, hint: 'an id like "search-1"' });
const text = string({ minLength: 1 });

const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
const SENIORITY = ['intern', 'junior', 'mid', 'senior', 'lead'] as const;
const EMPLOYMENT = ['full-time', 'part-time', 'contract', 'internship'] as const;

const searchSchema = object({
  id,
  name: text,
  // The user's own role titles; the agent may add synonyms the user approved.
  titles: arrayOf(text),
  seniority: arrayOf(oneOf(SENIORITY)),
  experienceYears: object({ min: number({ min: 0, max: 50 }), max: number({ min: 0, max: 50 }) }),
  mustSkills: arrayOf(text),
  niceSkills: arrayOf(text),
  // Pakistani city ids (PK_CITIES) for on-site/hybrid; empty = any city.
  cities: arrayOf(text),
  workModes: arrayOf(oneOf(WORK_MODES)),
  employment: arrayOf(oneOf(EMPLOYMENT)),
  // Monthly minimum in the given currency; undefined = no floor.
  salaryFloor: optional(
    object({ amount: number({ min: 0 }), currency: oneOf(['PKR', 'USD'] as const) }),
  ),
  nightShiftOk: boolean(),
  skipCompanies: arrayOf(text),
  // review: prepare applications for approval; shortlist: just list jobs.
  mode: oneOf(['review', 'shortlist'] as const),
});
export type Search = Infer<typeof searchSchema>;

// The direction gate (R1): confirmed only while confirmedVersion matches version, so any
// edit re-opens it.
export const searchesSchema = object({
  version: number({ integer: true, min: 1 }),
  confirmedVersion: optional(number({ integer: true, min: 1 })),
  confirmedAt: optional(isoDate()),
  searches: arrayOf(searchSchema),
});
export type SearchesFile = Infer<typeof searchesSchema>;

export const answersSchema = object({
  answers: arrayOf(
    object({
      // Stable key, e.g. "notice-period", "expected-salary-pkr", "hs-math-rank".
      key: id,
      question: text,
      answer: text,
      // legal / demographic answers are only ever used exactly as the user gave them.
      kind: oneOf(['fact', 'preference', 'legal', 'demographic'] as const),
      updatedAt: isoDate(),
    }),
  ),
});
export type AnswersFile = Infer<typeof answersSchema>;

export const gapsSchema = object({
  gaps: arrayOf(
    object({
      area: text,
      askedAt: isoDate(),
      outcome: oneOf(['added', 'none', 'pending'] as const),
      entryIds: arrayOf(string()),
    }),
  ),
});
export type GapsFile = Infer<typeof gapsSchema>;

// Entries Claude drafted (from the user's words or found elsewhere) wait here until the
// user approves them; profile.json only ever holds approved facts (plan, "Drafts are not facts").
export const draftsSchema = object({
  drafts: arrayOf(
    object({
      id,
      kind: oneOf(['experience-bullet', 'project-bullet', 'skill'] as const),
      parentId: optional(string()),
      text,
      why: text,
      createdAt: isoDate(),
    }),
  ),
});
export type DraftsFile = Infer<typeof draftsSchema>;

const APPLICATION_STATUS = [
  'prepared',
  'needs-you',
  'approved',
  'submitted',
  'skipped',
  'failed',
] as const;

export const applicationsSchema = object({
  applications: arrayOf(
    object({
      id,
      jobId: text,
      searchId: text,
      status: oneOf(APPLICATION_STATUS),
      cvPath: optional(string()),
      answers: arrayOf(
        object({
          question: text,
          answer: optional(string()),
          // todo: the user must answer (unknown, legal, or the employer forbids AI help, D19).
          from: oneOf(['profile', 'answers', 'todo'] as const),
        }),
      ),
      todo: arrayOf(text),
      note: optional(string()),
      preparedAt: isoDate(),
      updatedAt: isoDate(),
    }),
  ),
});
export type ApplicationsFile = Infer<typeof applicationsSchema>;

// Today's ranked list from the daily hunt (S1.4): what Claude reviews and tailors from.
export const matchesSchema = object({
  runAt: isoDate(),
  items: arrayOf(
    object({
      jobId: text,
      searchId: text,
      score: number({ min: 0, max: 100 }),
      fit: oneOf(['strong', 'good', 'stretch'] as const),
      reasons: arrayOf(string()),
      verdict: oneOf(['eligible', 'likely', 'unclear', 'not-eligible'] as const),
      verdictReasons: arrayOf(string()),
      // Rules couldn't decide; Claude reads the job and records a verdict (judge).
      needsClaude: boolean(),
      scam: oneOf(['ok', 'suspicious'] as const),
      title: text,
      company: string(),
      location: string(),
      url: text,
      source: text,
      applyLevel: oneOf(['B', 'C'] as const),
    }),
  ),
});
export type MatchesFile = Infer<typeof matchesSchema>;
