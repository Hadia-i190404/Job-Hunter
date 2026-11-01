import { describe, expect, it } from 'vitest';
import { ashby, lever } from '../../plugin/src/connectors/boards.ts';
import {
  himalayas,
  jobicy,
  remoteOk,
  weWorkRemotely,
  workingNomads,
} from '../../plugin/src/connectors/feeds.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { fakeHttp } from './fake-http.ts';

const q = { keywords: ['frontend engineer'], cities: [] };
const all = { keywords: [], cities: [] };

describe('free feeds', () => {
  it('Remote OK skips the legal notice and reads salary', async () => {
    const http = fakeHttp({
      'https://remoteok.com/api': JSON.stringify([
        { legal: 'Please link back to Remote OK' },
        {
          id: '1',
          position: 'Frontend Engineer',
          company: 'Example',
          location: 'Worldwide',
          url: 'https://remoteok.com/1',
          description: '<p>React</p>',
          date: '2026-10-31T00:00:00+00:00',
          salary_min: 60000,
          salary_max: 80000,
        },
        { id: '2', position: 'Accountant', company: 'Example', url: 'https://remoteok.com/2' },
      ]),
    });
    const r = await remoteOk.search(q, { http });
    expect(r.jobs).toHaveLength(1);
    expect(normalizeJob(r.jobs[0] ?? fail())).toMatchObject({
      id: 'remoteok:1',
      workMode: 'remote',
      locationText: 'Remote; applicants in: Worldwide',
      salary: { min: 60_000, max: 80_000, currency: 'USD', period: 'year' },
      description: 'React',
    });
  });

  it('We Work Remotely splits "Company: Title" and keeps the region', async () => {
    const rss = `<rss><channel><item><title>Example: Frontend Engineer</title><region>Anywhere in the World</region>
      <link>https://weworkremotely.com/remote-jobs/example-frontend</link><guid>https://weworkremotely.com/remote-jobs/example-frontend</guid>
      <description>&lt;p&gt;React&lt;/p&gt;</description></item></channel></rss>`;
    const r = await weWorkRemotely.search(q, {
      http: fakeHttp({ 'https://weworkremotely.com/': rss }),
    });
    expect(r.jobs[0]).toMatchObject({
      company: 'Example',
      title: 'Frontend Engineer',
      sourceId: 'example-frontend',
      location: 'Remote; applicants in: Anywhere in the World',
    });
  });

  it('Himalayas lists country restrictions or Worldwide, and salary', async () => {
    const body = JSON.stringify({
      jobs: [
        {
          title: 'Frontend Engineer',
          companyName: 'Example',
          guid: 'https://himalayas.app/companies/example/jobs/fe',
          applicationLink: 'https://himalayas.app/a',
          locationRestrictions: [],
          minSalary: 3000,
          maxSalary: 4000,
          currency: 'USD',
          salaryPeriod: 'monthly',
          pubDate: 1793528623,
          description: '<p>x</p>',
        },
        {
          title: 'Frontend Engineer',
          companyName: 'Other',
          guid: 'https://himalayas.app/companies/other/jobs/fe2',
          locationRestrictions: ['United States'],
          description: '',
        },
      ],
    });
    const r = await himalayas.search(q, { http: fakeHttp({ 'https://himalayas.app/': body }) });
    expect(r.jobs.map((j) => j.location)).toEqual([
      'Remote; applicants in: Worldwide',
      'Remote; applicants in: United States',
    ]);
    expect(r.jobs[0]).toMatchObject({
      salaryText: 'USD 3000 - 4000 per month',
      postedAt: new Date(1793528623000).toISOString(),
    });
  });

  it('Jobicy and Working Nomads map their fields', async () => {
    const http = fakeHttp({
      'https://jobicy.com/': JSON.stringify({
        jobs: [
          {
            id: 9,
            url: 'https://jobicy.com/9',
            jobTitle: 'Frontend Engineer',
            companyName: 'Example',
            jobGeo: 'EMEA,  APAC',
            jobDescription: '<p>x</p>',
          },
        ],
      }),
      'https://www.workingnomads.com/': JSON.stringify([
        {
          url: 'https://www.workingnomads.com/job/go/7/',
          title: 'Frontend Engineer',
          company_name: 'Example',
          location: 'Worldwide',
          description: '<p>y</p>',
        },
      ]),
    });
    expect((await jobicy.search(q, { http })).jobs[0]).toMatchObject({
      sourceId: '9',
      location: 'Remote; applicants in: EMEA, APAC',
    });
    expect((await workingNomads.search(q, { http })).jobs[0]).toMatchObject({
      sourceId: '7',
      location: 'Remote; applicants in: Worldwide',
    });
  });

  it('reports a blocked or malformed feed as broken', async () => {
    expect(
      (
        await jobicy.search(q, {
          http: fakeHttp({ 'https://': { status: 'blocked', message: 'blocked' } }),
        })
      ).status,
    ).toBe('broken');
    expect((await jobicy.search(q, { http: fakeHttp({ 'https://': 'not json' }) })).notes).toEqual([
      'unexpected format',
    ]);
  });
});

describe('Lever and Ashby boards', () => {
  it('Lever reads remote, hybrid and on-site locations', async () => {
    const body = JSON.stringify([
      {
        id: 'a1',
        text: 'Frontend Engineer',
        hostedUrl: 'https://jobs.lever.co/example/a1',
        workplaceType: 'remote',
        categories: { location: 'Worldwide' },
        descriptionPlain: 'React',
        lists: [{ text: 'You will' }],
        additionalPlain: '',
        createdAt: 1792767640768,
      },
      {
        id: 'a2',
        text: 'Engineer',
        hostedUrl: 'https://jobs.lever.co/example/a2',
        workplaceType: 'hybrid',
        categories: { location: 'London' },
      },
    ]);
    const r = await lever(['example']).search(all, {
      http: fakeHttp({ 'https://api.lever.co/v0/postings/example': body }),
    });
    expect(r.jobs.map((j) => [j.sourceId, j.location])).toEqual([
      ['example-a1', 'Remote; Worldwide'],
      ['example-a2', 'London (hybrid)'],
    ]);
    expect(normalizeJob(r.jobs[0] ?? fail()).workMode).toBe('remote');
  });

  it('Ashby reads secondary locations, remote and pay, and skips unlisted jobs', async () => {
    const body = JSON.stringify({
      jobs: [
        {
          id: 'b1',
          title: 'Frontend Engineer',
          jobUrl: 'https://jobs.ashbyhq.com/example/b1',
          location: 'Remote',
          secondaryLocations: [{ location: 'Pakistan' }],
          isRemote: true,
          workplaceType: 'Remote',
          descriptionPlain: 'React',
          publishedAt: '2026-10-01T00:00:00Z',
          compensation: { compensationTierSummary: '$80K – $100K' },
        },
        { id: 'b2', title: 'Hidden', jobUrl: 'https://x', isListed: false },
      ],
    });
    const r = await ashby(['example']).search(all, {
      http: fakeHttp({ 'https://api.ashbyhq.com/posting-api/job-board/example': body }),
    });
    expect(r.jobs).toHaveLength(1);
    expect(r.jobs[0]).toMatchObject({
      location: 'Remote; Remote; Pakistan',
      remoteFlag: true,
      salaryText: '$80K – $100K',
    });
  });

  it('is fallback when some boards fail and broken when all do', async () => {
    const http = fakeHttp({
      'https://api.ashbyhq.com/posting-api/job-board/good': JSON.stringify({ jobs: [] }),
      'https://api.ashbyhq.com/posting-api/job-board/weird': 'nope',
    });
    const partly = await ashby(['good', 'gone', 'weird']).search(all, { http });
    expect(partly.status).toBe('fallback');
    expect(partly.notes).toEqual(['gone: no route', 'weird: unexpected format']);
    expect((await ashby([]).search(all, { http })).status).toBe('broken');
  });
});

function fail(): never {
  throw new Error('expected a job');
}
