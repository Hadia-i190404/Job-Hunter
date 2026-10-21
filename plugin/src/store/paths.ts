import { homedir } from 'node:os';
import { join } from 'node:path';

// The data folder lives outside the repo, on the user's own computer (spec R9).
// JOB_HUNTER_HOME overrides it, for tests and for users who want it elsewhere.
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.JOB_HUNTER_HOME;
  return override !== undefined && override !== '' ? override : join(homedir(), 'JobHunter');
}

export const FILES = {
  meta: 'meta.json',
  settings: 'settings.json',
  log: 'log.jsonl',
  profile: 'profile.json',
  searches: 'searches.json',
  answers: 'answers.json',
  jobs: 'jobs.jsonl',
  assessments: 'assessments.jsonl',
  pipeline: 'pipeline.json',
  gaps: 'gaps.json',
  drafts: 'profile.drafts.json',
  applications: 'applications.json',
  cards: 'cards.json',
} as const;

export type FileKey = keyof typeof FILES;
