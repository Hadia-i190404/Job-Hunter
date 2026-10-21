import { describe, expect, it } from 'vitest';
import { greenhouse } from '../../plugin/src/connectors/greenhouse.ts';
import { mustakbil } from '../../plugin/src/connectors/mustakbil.ts';
import { connectors } from '../../plugin/src/connectors/registry.ts';
import { remotive } from '../../plugin/src/connectors/remotive.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { fakeHttp, fixture } from './fake-http.ts';

const blocked = { status: 'blocked' as const, message: 'blocked by the site (HTTP 403)' };

describe('remotive', () => {
  it('searches once per phrase and maps jobs', async () => {
    const http = fakeHttp({ 'https://remotive.com/api/remote-jobs': fixture('remotive.json') });
    const result = await remotive.search({ keywords: ['react developer'], cities: [] }, { http });
    expect(http.asked).toEqual(['https://remotive.com/api/remote-jobs?search=react%20developer']);
    expect(result.status).toBe('ok');
    expect(result.jobs).toHaveLength(1);
    const job = normalizeJob(result.jobs[0] ?? fail());
    expect(job).toMatchObject({
      id: 'remotive:2091133',
      title: 'Senior React Developer',
      company: 'Example Labs',
      workMode: 'remote',
      locationText: 'Remote; applicants in: Worldwide',
      salary: { min: 60_000, max: 80_000, currency: 'USD', period: 'year' },
      postedAt: '2026-10-17T16:04:29.000Z',
    });
    expect(job.description).toBe('Build things with React & TypeScript.\n• 5 years');
  });

  it('caps the number of phrases and says so', async () => {
    const http = fakeHttp({ 'https://remotive.com/': fixture('remotive.json') });
    const result = await remotive.search({ keywords: ['a', 'b', 'c', 'd'], cities: [] }, { http });
    expect(http.asked).toHaveLength(3);
    expect(result.status).toBe('fallback');
  });

  it('asks once with no phrases', async () => {
    const http = fakeHttp({ 'https://remotive.com/': fixture('remotive.json') });
    const result = await remotive.search({ keywords: [], cities: [] }, { http });
    expect(http.asked).toEqual(['https://remotive.com/api/remote-jobs']);
    expect(result.jobs).toHaveLength(2);
  });

  it('is broken when blocked or malformed', async () => {
    const q = { keywords: ['x'], cities: [] };
    expect((await remotive.search(q, { http: fakeHttp({ 'https://': blocked }) })).status).toBe(
      'broken',
    );
    expect(
      (await remotive.search(q, { http: fakeHttp({ 'https://': '{"nope":1}' }) })).notes,
    ).toEqual(['unexpected response format']);
  });
});

describe('greenhouse', () => {
  it('reads each board and filters by title', async () => {
    const http = fakeHttp({
      'https://boards-api.greenhouse.io/v1/boards/examplecorp/': fixture('greenhouse.json'),
    });
    const result = await greenhouse(['examplecorp']).search(
      { keywords: ['backend engineer'], cities: [] },
      { http },
    );
    expect(result.status).toBe('ok');
    const job = normalizeJob(result.jobs[0] ?? fail());
    expect(job).toMatchObject({
      id: 'greenhouse:examplecorp-1001',
      company: 'ExampleCorp',
      locationText: 'Remote, EMEA',
      workMode: 'remote',
      description: 'Work on APIs & services.',
    });
  });

  it('reports a partly failing watch-list as fallback, all failing as broken', async () => {
    const http = fakeHttp({
      'https://boards-api.greenhouse.io/v1/boards/examplecorp/': fixture('greenhouse.json'),
      'https://boards-api.greenhouse.io/v1/boards/gone/': { status: 'not-found', message: '404' },
      'https://boards-api.greenhouse.io/v1/boards/weird/': 'not json',
    });
    const q = { keywords: [], cities: [] };
    const partly = await greenhouse(['examplecorp', 'gone', 'weird']).search(q, { http });
    expect(partly.status).toBe('fallback');
    expect(partly.notes).toEqual(['gone: 404', 'weird: unexpected format']);
    expect((await greenhouse(['gone']).search(q, { http })).status).toBe('broken');
    expect((await greenhouse([]).search(q, { http })).status).toBe('broken');
  });
});

describe('mustakbil', () => {
  const routes = {
    'https://rss.mustakbil.com/': fixture('mustakbil-feed.xml'),
    'https://www.mustakbil.com/jobs/job/1000001': fixture('mustakbil-job.html'),
  };

  it('filters the feed and enriches new jobs from their page', async () => {
    const http = fakeHttp(routes);
    const result = await mustakbil.search(
      { keywords: ['accountant'], cities: ['lahore'] },
      { http },
    );
    expect(result).toMatchObject({ status: 'ok', notes: [] });
    expect(result.jobs).toHaveLength(1);
    const job = normalizeJob(result.jobs[0] ?? fail());
    expect(job).toMatchObject({
      id: 'mustakbil:1000001',
      title: 'Accountant',
      company: 'Example Traders',
      cities: ['lahore'],
      salary: { min: 50_000, max: 55_000, currency: 'PKR', period: 'month', periodInferred: false },
      postedAt: '2026-10-19T21:37:21.000Z',
      description: 'Job Description : Keep the books.\nPrepare monthly closing.',
    });
  });

  it('skips pages of known jobs and falls back to feed data when a page fails', async () => {
    const http = fakeHttp(routes);
    const result = await mustakbil.search(
      { keywords: ['accountant'], cities: [] },
      { http, isKnown: (id) => id === 'mustakbil:1000001' },
    );
    expect(http.asked).not.toContain('https://www.mustakbil.com/jobs/job/1000001');
    expect(result.jobs.map((j) => j.sourceId)).toEqual(['1000001', '1000002']);
    expect(result.status).toBe('fallback'); // 1000002's page has no route
    expect(result.jobs[1]?.description).toBe('Lead the finance team.');
  });

  it('respects the detail-fetch cap', async () => {
    const http = fakeHttp(routes);
    await mustakbil.search({ keywords: [], cities: [] }, { http, maxDetailFetches: 1 });
    expect(http.asked.filter((url) => url.includes('/jobs/job/'))).toHaveLength(1);
  });

  it('is broken when the feed is blocked', async () => {
    const http = fakeHttp({ 'https://': blocked });
    expect((await mustakbil.search({ keywords: [], cities: [] }, { http })).status).toBe('broken');
  });
});

describe('registry', () => {
  it('lists every connector with its apply level', () => {
    const list = connectors({ greenhouseBoards: [] }).map((c) => [c.id, c.applyLevel]);
    expect(list).toEqual([
      ['remotive', 'C'],
      ['mustakbil', 'C'],
      ['greenhouse', 'B'],
    ]);
  });
});

function fail(): never {
  throw new Error('expected a job');
}
