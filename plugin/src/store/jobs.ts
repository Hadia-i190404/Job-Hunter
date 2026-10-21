// jobs.jsonl: every job seen, one per line. A job seen again keeps its first-seen date
// and gets fresh details; jobs not seen for a while are dropped so the file stays small.
import { join } from 'node:path';
import { jobSchema, type Job } from '../pipeline/job.ts';
import { readJsonLines, writeJsonLinesAtomic, type LineReport } from './jsonl.ts';
import { FILES } from './paths.ts';

const KEEP_DAYS = 60;

export async function loadJobs(dir: string, report?: LineReport): Promise<Map<string, Job>> {
  const jobs = new Map<string, Job>();
  for await (const job of readJsonLines(join(dir, FILES.jobs), jobSchema, report))
    jobs.set(job.id, job);
  return jobs;
}

export interface SaveResult {
  added: number;
  updated: number;
  dropped: number;
  total: number;
}

export async function saveJobs(
  dir: string,
  incoming: readonly Job[],
  now = new Date(),
): Promise<SaveResult> {
  const jobs = await loadJobs(dir);
  let added = 0;
  for (const job of incoming) {
    const existing = jobs.get(job.id);
    if (existing === undefined) added += 1;
    jobs.set(job.id, {
      ...job,
      firstSeenAt: existing?.firstSeenAt ?? job.firstSeenAt,
      lastSeenAt: now.toISOString(),
    });
  }
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = [...jobs.values()].filter((job) => Date.parse(job.lastSeenAt) >= cutoff);
  await writeJsonLinesAtomic(join(dir, FILES.jobs), kept);
  return {
    added,
    updated: incoming.length - added,
    dropped: jobs.size - kept.length,
    total: kept.length,
  };
}
