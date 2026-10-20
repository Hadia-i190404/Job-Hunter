// Shapes of the data-folder files owned by the store (T3). Files whose shape belongs to
// a later task get their schema there: jobs (T4), profile (T7), searches (P1),
// answers, cards and pipeline (P2).
import {
  boolean,
  isoDate,
  number,
  object,
  oneOf,
  optional,
  recordOf,
  scalar,
  string,
  type Infer,
} from './core.ts';

export const metaSchema = object({
  schemaVersion: number({ integer: true, min: 1 }),
  createdAt: isoDate(),
});
export type Meta = Infer<typeof metaSchema>;

export const settingsSchema = object({
  paused: boolean(),
  // light: about 25 jobs judged by Claude per run (Pro); full: about 60 (Max). Spec D11.
  usage: oneOf(['light', 'full'] as const),
  // Platform id → enabled. Missing ids are enabled by default.
  platforms: recordOf(boolean()),
  followUpDays: number({ integer: true, min: 1, max: 60 }),
  // Local time of the daily run, HH:MM, 24-hour. Spec D12.
  dailyRunTime: string({ pattern: /^([01]\d|2[0-3]):[0-5]\d$/, hint: 'a time like 09:00' }),
});
export type Settings = Infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  paused: false,
  usage: 'light',
  platforms: {},
  followUpDays: 7,
  dailyRunTime: '09:00',
};

// One line of log.jsonl. `detail` holds counts and ids only, never personal data (R9).
export const logEventSchema = object({
  at: isoDate(),
  actor: oneOf(['agent', 'user'] as const),
  action: string({ minLength: 1 }),
  detail: optional(recordOf(scalar())),
});
export type LogEvent = Infer<typeof logEventSchema>;
