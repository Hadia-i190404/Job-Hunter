// The daily hunt (S1.4): every source for the confirmed searches → save → Pakistan
// check, scam check, duplicates, matching → today's ranked list in matches.json.
import type { HttpClient } from '../connectors/http.ts';
import { expandTitles } from '../connectors/keywords.ts';
import type { Connector, ConnectorStatus } from '../connectors/types.ts';
import { groupDuplicates } from '../pipeline/dedup.ts';
import { assessEligibility } from '../pipeline/eligibility.ts';
import type { Job } from '../pipeline/job.ts';
import { bestMatch } from '../pipeline/match.ts';
import { normalizeJob } from '../pipeline/normalize.ts';
import { checkScam } from '../pipeline/scam.ts';
import type { MatchesFile, Search } from '../schema/loop.ts';
import { loadDoc, saveDoc } from '../store/doc.ts';
import { loadJobs, saveJobs } from '../store/jobs.ts';
import { logEvent } from '../store/log.ts';
import { APPLICATIONS, MATCHES } from '../store/loop.ts';

interface SourceReport {
  source: string;
  status: ConnectorStatus;
  found: number;
  notes: string[];
}

export interface HuntResult {
  sources: SourceReport[];
  jobsSeen: number;
  newJobs: number;
  matched: number;
  strong: number;
  needsClaude: number;
}

type Item = MatchesFile['items'][number];

export async function runHunt(
  dir: string,
  searches: readonly Search[],
  deps: { http: HttpClient; connectors: readonly Connector[]; now?: Date },
): Promise<HuntResult> {
  const now = deps.now ?? new Date();
  const known = await loadJobs(dir);
  const query = {
    keywords: expandTitles(searches.flatMap((s) => s.titles)),
    cities: [...new Set(searches.flatMap((s) => s.cities))],
  };
  const results = await Promise.all(
    deps.connectors.map(async (connector) => ({
      connector,
      result: await connector.search(
        // Company boards are one request each whatever the filter: take everything and
        // let matching decide, which catches titles worded differently.
        connector.applyLevel === 'B' ? { keywords: [], cities: [] } : query,
        { http: deps.http, isKnown: (id) => known.has(id) },
      ),
    })),
  );
  const jobs = results.flatMap(({ result }) => result.jobs.map((raw) => normalizeJob(raw, now)));
  const saved = await saveJobs(dir, jobs, now);
  const levels = new Map(results.map(({ connector }) => [connector.id, connector.applyLevel]));
  const items = await rank(dir, jobs, searches, levels);
  await saveDoc(dir, MATCHES, { runAt: now.toISOString(), items });

  const result: HuntResult = {
    sources: results.map(({ connector, result: r }) => ({
      source: connector.label,
      status: r.status,
      found: r.jobs.length,
      notes: r.notes,
    })),
    jobsSeen: jobs.length,
    newJobs: saved.added,
    matched: items.length,
    strong: items.filter((i) => i.fit === 'strong').length,
    needsClaude: items.filter((i) => i.needsClaude).length,
  };
  await logEvent(
    dir,
    {
      actor: 'agent',
      action: 'hunt',
      detail: { seen: result.jobsSeen, new: result.newJobs, matched: result.matched },
    },
    now,
  );
  return result;
}

async function rank(
  dir: string,
  jobs: readonly Job[],
  searches: readonly Search[],
  levels: ReadonlyMap<string, 'B' | 'C'>,
): Promise<Item[]> {
  const handled = new Set((await loadDoc(dir, APPLICATIONS)).applications.map((a) => a.jobId));
  const items: Item[] = [];
  for (const { primary: job } of groupDuplicates(jobs)) {
    if (handled.has(job.id)) continue;
    const item = assess(job, searches, levels.get(job.source) ?? 'C');
    if (item !== undefined) items.push(item);
  }
  return items.sort((a, b) => b.score - a.score);
}

function assess(job: Job, searches: readonly Search[], applyLevel: 'B' | 'C'): Item | undefined {
  const scam = checkScam(job).level;
  if (scam === 'scam') return undefined;
  const eligibility = assessEligibility(job);
  const match = bestMatch(job, searches, eligibility);
  if (match === undefined || match.fit === 'no') return undefined;
  return {
    jobId: job.id,
    searchId: match.searchId,
    score: match.score,
    fit: match.fit,
    reasons: match.reasons,
    verdict: eligibility.verdict,
    verdictReasons: eligibility.reasons,
    needsClaude: eligibility.needsClaude,
    scam,
    title: job.title,
    company: job.company,
    location: job.locationText,
    url: job.url,
    source: job.source,
    applyLevel,
  };
}
