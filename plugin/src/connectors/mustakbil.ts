// Mustakbil.com (Pakistan): its RSS feed lists ~500 recent jobs in one request. Matching
// jobs not seen before get their page fetched for salary and full text (schema.org data).
import type { RawJob } from '../pipeline/job.ts';
import { matchPlace } from '../pipeline/location.ts';
import { htmlToText } from './html.ts';
import { jobPostingFromHtml } from './jsonld.ts';
import { titleMatches } from './keywords.ts';
import { parseRssItems, type FeedItem } from './rss.ts';
import type { Connector, ConnectorContext } from './types.ts';

const FEED = 'https://rss.mustakbil.com/jobs-rss?c=162'; // 162 = Pakistan
const DEFAULT_DETAIL_FETCHES = 15;

export const mustakbil: Connector = {
  id: 'mustakbil',
  label: 'Mustakbil.com',
  kind: 'feed',
  applyLevel: 'C',
  maxRunsPerDay: 4,
  search: async (query, context) => {
    const response = await context.http.get(FEED);
    if (response.status !== 'ok') return { status: 'broken', jobs: [], notes: [response.message] };
    const jobs = parseRssItems(response.text)
      .map(fromFeed)
      .filter((job): job is RawJob => job !== undefined)
      .filter((job) => titleMatches(job.title, query.keywords) && inCities(job, query.cities));
    const missed = await addDetails(jobs, context);
    const notes =
      missed > 0 ? [`${String(missed)} job pages could not be read; feed data used`] : [];
    return { status: missed > 0 ? 'fallback' : 'ok', jobs, notes };
  },
};

function fromFeed(item: FeedItem): RawJob | undefined {
  const url = item.link ?? item.guid;
  const id = url === undefined ? undefined : /\/job\/(\d+)/.exec(url)?.[1];
  if (url === undefined || id === undefined || item.title === undefined) return undefined;
  const raw: RawJob = {
    source: 'mustakbil',
    sourceId: id,
    url,
    // Feed titles end with " Jobs in <City>, Pakistan"; the city has its own field.
    title: item.title.replace(/\s+jobs? in\s+[^,]+(?:,\s*[^,]+)?$/i, '').trim(),
    company: item.company ?? '',
    location: [item.city, item.country].filter(Boolean).join(', '),
    description: htmlToText(item.description ?? ''),
  };
  if (item.pubdate !== undefined) raw.postedAt = item.pubdate;
  return raw;
}

function inCities(job: RawJob, cities: readonly string[]): boolean {
  if (cities.length === 0) return true;
  const found = matchPlace(job.location ?? '').cities as string[];
  return cities.some((city) => found.includes(city));
}

// Fetch detail pages for new jobs only, up to the cap. Returns how many failed.
async function addDetails(jobs: RawJob[], context: ConnectorContext): Promise<number> {
  const limit = context.maxDetailFetches ?? DEFAULT_DETAIL_FETCHES;
  const fresh = jobs.filter((job) => context.isKnown?.(`mustakbil:${job.sourceId}`) !== true);
  const outcomes = await Promise.all(
    fresh.slice(0, limit).map(async (job) => {
      const page = await context.http.get(job.url);
      const posting = page.status === 'ok' ? jobPostingFromHtml(page.text) : undefined;
      if (posting === undefined) return false;
      if (posting.salaryText !== undefined) job.salaryText = posting.salaryText;
      if (posting.description !== undefined) job.description = posting.description;
      if (posting.remoteFlag === true) job.remoteFlag = true;
      return true;
    }),
  );
  return outcomes.filter((ok) => !ok).length;
}
