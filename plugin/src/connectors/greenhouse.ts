// Greenhouse public job-board API, one board per company on the watch-list. These are
// the best jobs to apply to: the employer's own form, no login, so level B (plan).
import type { RawJob } from '../pipeline/job.ts';
import { htmlToText } from './html.ts';
import { titleMatches } from './keywords.ts';
import type { Connector, ConnectorStatus } from './types.ts';

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  location?: { name?: string };
  content?: string;
  first_published?: string;
  updated_at?: string;
}

const boardUrl = (board: string): string =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;

export function greenhouse(boards: readonly string[]): Connector {
  return {
    id: 'greenhouse',
    label: 'Greenhouse career sites',
    kind: 'api',
    applyLevel: 'B',
    maxRunsPerDay: 24,
    search: async (query, { http }) => {
      const results = await Promise.all(
        boards.map(async (board) => ({ board, response: await http.get(boardUrl(board)) })),
      );
      const jobs: RawJob[] = [];
      const notes: string[] = [];
      for (const { board, response } of results) {
        const parsed = response.status === 'ok' ? readJobs(response.text) : undefined;
        if (parsed === undefined) {
          notes.push(
            `${board}: ${response.status === 'ok' ? 'unexpected format' : response.message}`,
          );
          continue;
        }
        const matching = parsed.filter((job) => titleMatches(job.title, query.keywords));
        jobs.push(...matching.map((job) => toRawJob(job, board)));
      }
      return { status: overall(notes.length, boards.length), jobs, notes };
    },
  };
}

function readJobs(text: string): GreenhouseJob[] | undefined {
  try {
    const data = JSON.parse(text) as { jobs?: unknown };
    return Array.isArray(data.jobs) ? (data.jobs as GreenhouseJob[]) : undefined;
  } catch {
    return undefined;
  }
}

function toRawJob(job: GreenhouseJob, board: string): RawJob {
  const raw: RawJob = {
    source: 'greenhouse',
    sourceId: `${board}-${String(job.id)}`,
    url: job.absolute_url,
    title: job.title,
    company: job.company_name ?? board,
    location: job.location?.name ?? '',
    // Content arrives entity-escaped HTML; htmlToText decodes it.
    description: htmlToText(htmlToText(job.content ?? '')),
  };
  const posted = job.first_published ?? job.updated_at;
  if (posted !== undefined) raw.postedAt = posted;
  return raw;
}

function overall(failed: number, total: number): ConnectorStatus {
  if (total === 0 || failed === total) return 'broken';
  return failed > 0 ? 'fallback' : 'ok';
}
