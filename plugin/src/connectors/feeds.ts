// Free remote-job feeds (S2 #1). Each one request per run, filtered here by the user's
// titles. Their terms ask for a link back and credit, which every job keeps (its url
// points to the source and its `source` names it).
import type { RawJob } from '../pipeline/job.ts';
import { htmlToText } from './html.ts';
import { titleMatches } from './keywords.ts';
import { parseRssItems } from './rss.ts';
import type { Connector, ConnectorResult } from './types.ts';

type Parse = (text: string) => RawJob[] | undefined;

function feed(id: string, label: string, url: string, parse: Parse): Connector {
  return {
    id,
    label,
    kind: 'feed',
    applyLevel: 'C',
    maxRunsPerDay: 4,
    search: async (query, { http }): Promise<ConnectorResult> => {
      const response = await http.get(url);
      if (response.status !== 'ok')
        return { status: 'broken', jobs: [], notes: [response.message] };
      const jobs = safely(() => parse(response.text));
      if (jobs === undefined) return { status: 'broken', jobs: [], notes: ['unexpected format'] };
      return {
        status: 'ok',
        jobs: jobs.filter((j) => titleMatches(j.title, query.keywords)),
        notes: [],
      };
    },
  };
}

function safely<T>(run: () => T | undefined): T | undefined {
  try {
    return run();
  } catch {
    return undefined;
  }
}

const str = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : [];
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    : [];

export const remoteOk = feed('remoteok', 'Remote OK', 'https://remoteok.com/api', (text) =>
  // The first element is Remote OK's legal notice, not a job.
  records(JSON.parse(text))
    .filter((j) => j.position !== undefined)
    .map((j) => {
      const raw: RawJob = {
        source: 'remoteok',
        sourceId: str(j.id),
        url: str(j.url),
        title: str(j.position),
        company: str(j.company),
        location: `Remote; applicants in: ${str(j.location) || 'not stated'}`,
        remoteFlag: true,
        description: htmlToText(str(j.description)),
        postedAt: str(j.date),
      };
      const min = Number(j.salary_min);
      const max = Number(j.salary_max);
      if (min > 0) raw.salaryText = `$${String(min)} - $${String(max > min ? max : min)} a year`;
      return raw;
    }),
);

export const weWorkRemotely = feed(
  'weworkremotely',
  'We Work Remotely',
  'https://weworkremotely.com/remote-jobs.rss',
  (text) =>
    parseRssItems(text).map((item) => {
      // Titles read "Company: Job title".
      const [company = '', ...rest] = (item.title ?? '').split(': ');
      return {
        source: 'weworkremotely',
        sourceId: (item.guid ?? item.link ?? '').replace(/.*\//, ''),
        url: item.link ?? item.guid ?? '',
        title: rest.join(': ') || company,
        company: rest.length > 0 ? company : '',
        location: `Remote; applicants in: ${item.region ?? 'not stated'}`,
        remoteFlag: true,
        description: htmlToText(item.description ?? ''),
        postedAt: item.pubdate ?? '',
      };
    }),
);

export const himalayas = feed(
  'himalayas',
  'Himalayas',
  'https://himalayas.app/jobs/api?limit=100',
  (text) =>
    records((JSON.parse(text) as { jobs?: unknown }).jobs).map((j) => {
      const countries = list(j.locationRestrictions);
      const raw: RawJob = {
        source: 'himalayas',
        sourceId: str(j.guid).replace(/.*\/jobs\//, ''),
        url: str(j.applicationLink) || str(j.guid),
        title: str(j.title),
        company: str(j.companyName),
        location: `Remote; applicants in: ${countries.length > 0 ? countries.join(', ') : 'Worldwide'}`,
        remoteFlag: true,
        description: htmlToText(str(j.description)),
      };
      const min = Number(j.minSalary);
      if (min > 0)
        raw.salaryText = `${str(j.currency) || 'USD'} ${String(min)} - ${String(Number(j.maxSalary) || min)} per ${str(j.salaryPeriod) === 'annual' ? 'year' : 'month'}`;
      const posted = Number(j.pubDate);
      if (posted > 0) raw.postedAt = new Date(posted * 1000).toISOString();
      return raw;
    }),
);

export const jobicy = feed(
  'jobicy',
  'Jobicy',
  'https://jobicy.com/api/v2/remote-jobs?count=100',
  (text) =>
    records((JSON.parse(text) as { jobs?: unknown }).jobs).map((j) => ({
      source: 'jobicy',
      sourceId: str(j.id),
      url: str(j.url),
      title: str(j.jobTitle),
      company: str(j.companyName),
      location: `Remote; applicants in: ${str(j.jobGeo).replace(/\s+/g, ' ') || 'not stated'}`,
      remoteFlag: true,
      description: htmlToText(str(j.jobDescription)),
      postedAt: str(j.pubDate),
    })),
);

export const workingNomads = feed(
  'workingnomads',
  'Working Nomads',
  'https://www.workingnomads.com/api/exposed_jobs/',
  (text) =>
    records(JSON.parse(text)).map((j) => ({
      source: 'workingnomads',
      sourceId: str(j.url).replace(/\/$/, '').replace(/.*\//, ''),
      url: str(j.url),
      title: str(j.title),
      company: str(j.company_name),
      location: `Remote; applicants in: ${str(j.location) || 'not stated'}`,
      remoteFlag: true,
      description: htmlToText(str(j.description)),
      postedAt: str(j.pub_date),
    })),
);
