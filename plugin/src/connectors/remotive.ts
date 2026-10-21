// Remotive public API. Its terms: link back to the Remotive job page and credit
// Remotive as the source, fetch at most 4 times a day, and never repost jobs elsewhere.
// The free API returns at most 10 jobs per request (checked 21 Oct 2026), so it searches
// once per phrase, for up to 3 phrases: within the 4-a-day limit on a daily run.
import type { RawJob } from '../pipeline/job.ts';
import { htmlToText } from './html.ts';
import { titleMatches } from './keywords.ts';
import type { Connector, ConnectorResult } from './types.ts';

const API = 'https://remotive.com/api/remote-jobs';
const MAX_PHRASES = 3;

interface RemotiveJob {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  publication_date?: string;
}

export const remotive: Connector = {
  id: 'remotive',
  label: 'Remotive',
  kind: 'api',
  applyLevel: 'C',
  maxRunsPerDay: 4,
  search: async (query, { http }) => {
    const phrases = query.keywords.slice(0, MAX_PHRASES);
    const urls =
      phrases.length === 0 ? [API] : phrases.map((p) => `${API}?search=${encodeURIComponent(p)}`);
    const responses = await Promise.all(urls.map((url) => http.get(url)));
    const byId = new Map<string, RemotiveJob>();
    const notes: string[] = [];
    for (const response of responses) {
      const jobs = response.status === 'ok' ? readJobs(response.text) : undefined;
      if (jobs === undefined) {
        notes.push(response.status === 'ok' ? 'unexpected response format' : response.message);
        continue;
      }
      for (const job of jobs) byId.set(String(job.id), job);
    }
    if (notes.length === responses.length) return broken(notes.join('; '));
    if (query.keywords.length > MAX_PHRASES) {
      notes.push(`searched the first ${String(MAX_PHRASES)} phrases only (Remotive's daily limit)`);
    }
    const jobs = [...byId.values()].filter((job) => titleMatches(job.title, query.keywords));
    return { status: notes.length > 0 ? 'fallback' : 'ok', jobs: jobs.map(toRawJob), notes };
  },
};

function readJobs(text: string): RemotiveJob[] | undefined {
  try {
    const data = JSON.parse(text) as { jobs?: unknown };
    return Array.isArray(data.jobs) ? (data.jobs as RemotiveJob[]) : undefined;
  } catch {
    return undefined;
  }
}

function toRawJob(job: RemotiveJob): RawJob {
  const raw: RawJob = {
    source: 'remotive',
    sourceId: String(job.id),
    url: job.url,
    title: job.title,
    company: job.company_name,
    location: `Remote; applicants in: ${job.candidate_required_location ?? 'not stated'}`,
    remoteFlag: true,
    description: htmlToText(job.description ?? ''),
  };
  if (job.salary !== undefined && job.salary !== '') raw.salaryText = job.salary;
  if (job.publication_date !== undefined) raw.postedAt = `${job.publication_date}Z`;
  return raw;
}

function broken(message: string): ConnectorResult {
  return { status: 'broken', jobs: [], notes: [message] };
}
