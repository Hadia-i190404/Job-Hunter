// Add one job by hand (S2.3): a link the user pasted, a job found by web search on a
// site that blocks scripts (Rozee, LinkedIn, Indeed…), or pasted job text. It gets the
// same checks as the daily hunt and joins today's list.
import { createHash } from 'node:crypto';
import type { HttpClient } from '../connectors/http.ts';
import { jobPostingFromHtml } from '../connectors/jsonld.ts';
import { assessEligibility } from '../pipeline/eligibility.ts';
import type { RawJob } from '../pipeline/job.ts';
import { bestMatch } from '../pipeline/match.ts';
import { normalizeJob } from '../pipeline/normalize.ts';
import { checkScam } from '../pipeline/scam.ts';
import type { MatchesFile } from '../schema/loop.ts';
import { loadDoc, saveDoc } from '../store/doc.ts';
import { saveJobs } from '../store/jobs.ts';
import { MATCHES, SEARCHES } from '../store/loop.ts';

// Career sites whose forms Job Hunter fills, by the shape of their job links.
const BOARD_LINKS: readonly (readonly [string, RegExp])[] = [
  ['greenhouse', /greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/],
  ['lever', /jobs\.lever\.co\/([\w-]+)\/([\w-]+)/],
  ['ashby', /jobs\.ashbyhq\.com\/([\w-]+)\/([\w-]+)/],
];

export interface ManualJob {
  url: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  salaryText?: string;
  // Where it came from, e.g. "rozee", "linkedin", "indeed"; else the link's host.
  source?: string;
}

export type AddResult =
  | { added: true; item: MatchesFile['items'][number] }
  | { added: false; reason: string; jobId: string };

// The source and id a link maps to: a known board, else the site's name + a link hash.
export function identify(
  url: string,
  source?: string,
): { source: string; sourceId: string; applyLevel: 'B' | 'C' } {
  for (const [board, pattern] of BOARD_LINKS) {
    const m = pattern.exec(url);
    if (m) return { source: board, sourceId: `${m[1] ?? ''}-${m[2] ?? ''}`, applyLevel: 'B' };
  }
  const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0] ?? 'web';
  const sourceId = createHash('sha1').update(url).digest('hex').slice(0, 12);
  return { source: source ?? host, sourceId, applyLevel: 'C' };
}

// Reads the job's standard data from its page; undefined when blocked or unreadable.
export async function readJobPage(http: HttpClient, url: string): Promise<ManualJob | undefined> {
  const page = await http.get(url);
  if (page.status !== 'ok') return undefined;
  const posting = jobPostingFromHtml(page.text);
  if (posting?.title === undefined) return undefined;
  const job: ManualJob = { url, title: posting.title, company: posting.company ?? '' };
  if (posting.location !== undefined) job.location = posting.location;
  if (posting.description !== undefined) job.description = posting.description;
  if (posting.salaryText !== undefined) job.salaryText = posting.salaryText;
  return job;
}

export async function addJob(dir: string, input: ManualJob, now = new Date()): Promise<AddResult> {
  const { source, sourceId, applyLevel } = identify(input.url, input.source);
  const raw: RawJob = {
    source,
    sourceId,
    url: input.url,
    title: input.title,
    company: input.company,
  };
  if (input.location !== undefined) raw.location = input.location;
  if (input.description !== undefined) raw.description = input.description;
  if (input.salaryText !== undefined) raw.salaryText = input.salaryText;
  const job = normalizeJob(raw, now);
  await saveJobs(dir, [job], now);

  if (checkScam(job).level === 'scam')
    return { added: false, reason: 'Looks like a scam', jobId: job.id };
  const eligibility = assessEligibility(job);
  const match = bestMatch(job, (await loadDoc(dir, SEARCHES)).searches, eligibility);
  if (match === undefined || match.fit === 'no') {
    return {
      added: false,
      reason: match?.blockers[0] ?? 'Doesn’t match your searches',
      jobId: job.id,
    };
  }
  const item = {
    jobId: job.id,
    searchId: match.searchId,
    score: match.score,
    fit: match.fit,
    reasons: match.reasons,
    verdict: eligibility.verdict,
    verdictReasons: eligibility.reasons,
    needsClaude: eligibility.needsClaude,
    scam: 'ok' as const,
    title: job.title,
    company: job.company,
    location: job.locationText,
    url: job.url,
    source: job.source,
    applyLevel,
  };
  const file = await loadDoc(dir, MATCHES);
  const items = [...file.items.filter((i) => i.jobId !== job.id), item].sort(
    (a, b) => b.score - a.score,
  );
  await saveDoc(dir, MATCHES, { ...file, items });
  return { added: true, item };
}
