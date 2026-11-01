// Company job boards on Lever and Ashby (S2 #1), one public request per company on the
// watch-list, like Greenhouse. Everything is taken and matching decides.
import type { RawJob } from '../pipeline/job.ts';
import type { Connector, ConnectorStatus } from './types.ts';

type Parse = (text: string, board: string) => RawJob[];

function boardConnector(id: string, label: string, url: (board: string) => string, parse: Parse) {
  return (boards: readonly string[]): Connector => ({
    id,
    label,
    kind: 'api',
    applyLevel: 'C',
    maxRunsPerDay: 24,
    search: async (_query, { http }) => {
      const results = await Promise.all(
        boards.map(async (board) => ({ board, response: await http.get(url(board)) })),
      );
      const jobs: RawJob[] = [];
      const notes: string[] = [];
      for (const { board, response } of results) {
        if (response.status !== 'ok') {
          notes.push(`${board}: ${response.message}`);
          continue;
        }
        try {
          jobs.push(...parse(response.text, board));
        } catch {
          notes.push(`${board}: unexpected format`);
        }
      }
      return { status: overall(notes.length, boards.length), jobs, notes };
    },
  });
}

function overall(failed: number, total: number): ConnectorStatus {
  if (total === 0 || failed === total) return 'broken';
  return failed > 0 ? 'fallback' : 'ok';
}

type Json = Record<string, unknown>;
const str = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const obj = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const arr = (value: unknown): Json[] => (Array.isArray(value) ? value.map(obj) : []);

export const lever = boardConnector(
  'lever',
  'Lever career sites',
  (board) => `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`,
  (text, board) =>
    arr(JSON.parse(text)).map((j) => {
      const categories = obj(j.categories);
      const workplace = str(j.workplaceType);
      const place = str(categories.location);
      const raw: RawJob = {
        source: 'lever',
        sourceId: `${board}-${str(j.id)}`,
        url: str(j.hostedUrl),
        title: str(j.text),
        company: board,
        location:
          workplace === 'remote'
            ? `Remote; ${place}`
            : `${place}${workplace ? ` (${workplace})` : ''}`,
        description: [
          str(j.descriptionPlain),
          ...arr(j.lists).map((l) => str(l.text)),
          str(j.additionalPlain),
        ].join('\n'),
      };
      const created = Number(j.createdAt);
      if (created > 0) raw.postedAt = new Date(created).toISOString();
      return raw;
    }),
);

export const ashby = boardConnector(
  'ashby',
  'Ashby career sites',
  (board) =>
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`,
  (text, board) =>
    arr(obj(JSON.parse(text)).jobs)
      .filter((j) => j.isListed !== false)
      .map((j) => {
        const places = [
          str(j.location),
          ...arr(j.secondaryLocations).map((l) => str(l.location)),
        ].filter(Boolean);
        const remote = j.isRemote === true || str(j.workplaceType) === 'Remote';
        const raw: RawJob = {
          source: 'ashby',
          sourceId: `${board}-${str(j.id)}`,
          url: str(j.jobUrl),
          title: str(j.title),
          company: board,
          location: `${remote ? 'Remote; ' : ''}${places.join('; ')}${str(j.workplaceType) === 'Hybrid' ? ' (hybrid)' : ''}`,
          description: str(j.descriptionPlain),
          postedAt: str(j.publishedAt),
        };
        const pay = str(obj(j.compensation).compensationTierSummary);
        if (pay !== '') raw.salaryText = pay;
        if (remote) raw.remoteFlag = true;
        return raw;
      }),
);
