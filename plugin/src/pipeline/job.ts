// The canonical job record: every connector's output becomes one of these (spec R4).
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
} from '../schema/core.ts';
import { CURRENCIES } from './fx.ts';
import { PK_CITIES } from './location.ts';

// What a connector hands over: raw text straight from the site.
export interface RawJob {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  salaryText?: string;
  postedAt?: string;
  // Some APIs say "remote" as a field rather than in text.
  remoteFlag?: boolean;
}

const range = object({ min: number({ min: 0 }), max: number({ min: 0 }) });

const salarySchema = object({
  min: number({ min: 0 }),
  max: number({ min: 0 }),
  currency: oneOf(CURRENCIES),
  period: oneOf(['hour', 'day', 'week', 'month', 'year'] as const),
  periodInferred: boolean(),
  pkrPerMonth: range,
  usdPerMonth: range,
});

export const jobSchema = object({
  id: string({ minLength: 3 }),
  source: string({ minLength: 1 }),
  sourceId: string({ minLength: 1 }),
  url: string({ pattern: /^https?:\/\//, hint: 'an http(s) link' }),
  title: string({ minLength: 1 }),
  company: string(),
  companyKey: string(),
  locationText: string(),
  cities: arrayOf(oneOf(Object.keys(PK_CITIES) as (keyof typeof PK_CITIES)[])),
  inPakistan: boolean(),
  workMode: oneOf(['onsite', 'hybrid', 'remote', 'unknown'] as const),
  salary: optional(salarySchema),
  salaryText: optional(string()),
  description: string(),
  postedAt: optional(isoDate()),
  firstSeenAt: isoDate(),
  lastSeenAt: isoDate(),
});

export type Job = Infer<typeof jobSchema>;
