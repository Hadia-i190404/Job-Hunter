import { describe, expect, it } from 'vitest';
import { expandTitles } from '../../plugin/src/connectors/keywords.ts';
import { greenhouse } from '../../plugin/src/connectors/greenhouse.ts';
import { mustakbil } from '../../plugin/src/connectors/mustakbil.ts';
import { remotive } from '../../plugin/src/connectors/remotive.ts';
import { runHunt } from '../../plugin/src/hunt/run.ts';
import type { Search } from '../../plugin/src/schema/loop.ts';
import { loadDoc, saveDoc } from '../../plugin/src/store/doc.ts';
import { loadJobs } from '../../plugin/src/store/jobs.ts';
import { APPLICATIONS, MATCHES } from '../../plugin/src/store/loop.ts';
import { fakeHttp, fixture } from '../connectors/fake-http.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

const base: Omit<Search, 'id' | 'name' | 'titles' | 'workModes' | 'cities'> = {
  seniority: ['mid', 'senior'],
  experienceYears: { min: 1, max: 6 },
  mustSkills: [],
  niceSkills: [],
  employment: ['full-time'],
  nightShiftOk: true,
  skipCompanies: [],
  mode: 'review',
};
const searches: Search[] = [
  {
    ...base,
    id: 'search-1',
    name: 'Backend, remote',
    titles: ['Backend Engineer', 'React Developer'],
    workModes: ['remote'],
    cities: [],
  },
  {
    ...base,
    id: 'search-2',
    name: 'Accountant, Lahore',
    titles: ['Accountant'],
    workModes: ['onsite', 'hybrid'],
    cities: ['lahore'],
  },
];

const http = () =>
  fakeHttp({
    'https://remotive.com/': fixture('remotive.json'),
    'https://boards-api.greenhouse.io/v1/boards/examplecorp/': fixture('greenhouse.json'),
    'https://rss.mustakbil.com/': fixture('mustakbil-feed.xml'),
    'https://www.mustakbil.com/jobs/job/1000001': fixture('mustakbil-job.html'),
  });
const sources = [remotive, mustakbil, greenhouse(['examplecorp'])];

describe('expandTitles', () => {
  it('adds the spellings sites use', () => {
    const variants = expandTitles(['Frontend Developer', ' ']).map((t) => t.toLowerCase());
    expect(variants[0]).toBe('frontend developer'); // the user's own title stays first
    expect(variants).toEqual(expect.arrayContaining(['frontend engineer', 'front end developer']));
  });
});

describe('runHunt', () => {
  it('searches, saves, ranks and writes today’s list', async () => {
    const dir = await tempDir();
    const result = await runHunt(dir, searches, {
      http: http(),
      connectors: sources,
      now: new Date(Date.UTC(2026, 9, 22)),
    });
    // Remotive searches only the first 3 phrases (its daily limit), so it reports fallback.
    expect(result.sources.map((s) => [s.source, s.status])).toEqual([
      ['Remotive', 'fallback'],
      ['Mustakbil.com', 'ok'],
      ['Greenhouse career sites', 'ok'],
    ]);
    expect(result.newJobs).toBe(result.jobsSeen);
    const matches = await loadDoc(dir, MATCHES);
    const byJob = new Map(matches.items.map((i) => [i.jobId, i]));
    // Remote EMEA backend role: matches search-1, but EMEA needs Claude's look.
    expect(byJob.get('greenhouse:examplecorp-1001')).toMatchObject({
      searchId: 'search-1',
      applyLevel: 'B',
      needsClaude: true,
    });
    // Worldwide React role on Remotive matches; the US-only one never appears.
    expect(byJob.get('remotive:2091133')).toMatchObject({
      searchId: 'search-1',
      verdict: 'eligible',
      applyLevel: 'C',
    });
    expect(byJob.has('remotive:2091200')).toBe(false);
    // Lahore accountant matches search-2; the Karachi one is in the wrong city.
    expect(byJob.get('mustakbil:1000001')).toMatchObject({ searchId: 'search-2' });
    expect(byJob.has('mustakbil:1000002')).toBe(false);
    expect(matches.items.map((i) => i.score)).toEqual(
      [...matches.items.map((i) => i.score)].sort((a, b) => b - a),
    );
    expect((await loadJobs(dir)).size).toBe(result.jobsSeen);
  });

  it('skips jobs that already have an application', async () => {
    const dir = await tempDir();
    const now = new Date(0).toISOString();
    await saveDoc(dir, APPLICATIONS, {
      applications: [
        {
          id: 'app-1',
          jobId: 'remotive:2091133',
          searchId: 'search-1',
          status: 'submitted',
          answers: [],
          todo: [],
          preparedAt: now,
          updatedAt: now,
        },
      ],
    });
    await runHunt(dir, searches, { http: http(), connectors: sources });
    expect((await loadDoc(dir, MATCHES)).items.some((i) => i.jobId === 'remotive:2091133')).toBe(
      false,
    );
  });
});
