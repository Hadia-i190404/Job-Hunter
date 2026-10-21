// The same job posted on several boards shows once (spec R4, U9). Jobs are grouped by
// company + title words (any order) + place; the best copy of each group is shown.
import type { Job } from './job.ts';

type DedupFacts = Pick<
  Job,
  'id' | 'source' | 'companyKey' | 'title' | 'cities' | 'workMode' | 'description' | 'firstSeenAt'
> &
  Partial<Pick<Job, 'salary'>>;

const FILLER = new Set([
  'a',
  'an',
  'the',
  'for',
  'and',
  'of',
  'job',
  'jobs',
  'position',
  'opening',
  'vacancy',
  'required',
]);

// Sources whose apply form Job Hunter can fill (level B) make the best primary copy.
const LEVEL_B_SOURCES = new Set([
  'greenhouse',
  'lever',
  'ashby',
  'workable',
  'smartrecruiters',
  'recruitee',
]);

export function dedupKey(job: DedupFacts): string {
  // Without a company name two "Accountant" posts can't be told apart: keep them separate.
  if (job.companyKey === '') return `id:${job.id}`;
  const words = [...new Set(job.title.toLowerCase().split(/[^\p{L}\p{N}+#]+/u))]
    .filter((word) => word !== '' && !FILLER.has(word))
    .sort();
  const place = job.workMode === 'remote' ? 'remote' : [...job.cities].sort().join('+');
  return `${job.companyKey}|${words.join(' ')}|${place}`;
}

export interface DedupGroup<T extends DedupFacts> {
  primary: T;
  duplicates: T[];
}

export function groupDuplicates<T extends DedupFacts>(jobs: readonly T[]): DedupGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const job of jobs) {
    const key = dedupKey(job);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()].flatMap((members) => {
    const [primary, ...duplicates] = [...members].sort(byQuality);
    return primary === undefined ? [] : [{ primary, duplicates }];
  });
}

function byQuality(a: DedupFacts, b: DedupFacts): number {
  return (
    rank(b) - rank(a) ||
    b.description.length - a.description.length ||
    a.firstSeenAt.localeCompare(b.firstSeenAt)
  );
}

function rank(job: DedupFacts): number {
  return (LEVEL_B_SOURCES.has(job.source) ? 2 : 0) + (job.salary === undefined ? 0 : 1);
}
