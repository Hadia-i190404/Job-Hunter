// The loop's documents (Slice 1) and the few rules that belong with them.
import {
  answersSchema,
  applicationsSchema,
  draftsSchema,
  gapsSchema,
  matchesSchema,
  searchesSchema,
  type AnswersFile,
  type ApplicationsFile,
  type DraftsFile,
  type GapsFile,
  type MatchesFile,
  type SearchesFile,
} from '../schema/loop.ts';
import { loadDoc, saveDoc, type Doc } from './doc.ts';
import { FILES } from './paths.ts';

export const SEARCHES: Doc<SearchesFile> = {
  file: FILES.searches,
  schema: searchesSchema,
  empty: () => ({ version: 1, searches: [] }),
};
export const ANSWERS: Doc<AnswersFile> = {
  file: FILES.answers,
  schema: answersSchema,
  empty: () => ({ answers: [] }),
};
export const GAPS: Doc<GapsFile> = {
  file: FILES.gaps,
  schema: gapsSchema,
  empty: () => ({ gaps: [] }),
};
export const DRAFTS: Doc<DraftsFile> = {
  file: FILES.drafts,
  schema: draftsSchema,
  empty: () => ({ drafts: [] }),
};
export const APPLICATIONS: Doc<ApplicationsFile> = {
  file: FILES.applications,
  schema: applicationsSchema,
  empty: () => ({ applications: [] }),
};

export const MATCHES: Doc<MatchesFile> = {
  file: FILES.matches,
  schema: matchesSchema,
  empty: () => ({ runAt: new Date(0).toISOString(), items: [] }),
};

// The direction gate (R1): nothing outward happens until the current searches are confirmed.
export function isConfirmed(file: SearchesFile): boolean {
  return file.searches.length > 0 && file.confirmedVersion === file.version;
}

// Any change to the searches bumps the version, which re-opens the gate.
export async function saveSearches(
  dir: string,
  searches: SearchesFile['searches'],
): Promise<SearchesFile> {
  const current = await loadDoc(dir, SEARCHES);
  const next: SearchesFile = { version: current.version + 1, searches };
  await saveDoc(dir, SEARCHES, next);
  return next;
}

export async function confirmSearches(dir: string, now = new Date()): Promise<SearchesFile> {
  const current = await loadDoc(dir, SEARCHES);
  if (current.searches.length === 0) throw new Error('No searches to confirm');
  const next = { ...current, confirmedVersion: current.version, confirmedAt: now.toISOString() };
  await saveDoc(dir, SEARCHES, next);
  return next;
}

type Answer = AnswersFile['answers'][number];

// Answers are asked once (D20): a new answer for the same key replaces the old one.
export async function upsertAnswers(
  dir: string,
  entries: readonly Omit<Answer, 'updatedAt'>[],
  now = new Date(),
): Promise<AnswersFile> {
  const current = await loadDoc(dir, ANSWERS);
  const byKey = new Map(current.answers.map((answer) => [answer.key, answer]));
  for (const entry of entries) byKey.set(entry.key, { ...entry, updatedAt: now.toISOString() });
  const next = { answers: [...byKey.values()] };
  await saveDoc(dir, ANSWERS, next);
  return next;
}
