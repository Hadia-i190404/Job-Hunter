import { describe, expect, it } from 'vitest';
import { addJob, identify, readJobPage } from '../../plugin/src/hunt/add-job.ts';
import type { Search } from '../../plugin/src/schema/loop.ts';
import { loadDoc } from '../../plugin/src/store/doc.ts';
import { loadJobs } from '../../plugin/src/store/jobs.ts';
import { MATCHES, saveSearches } from '../../plugin/src/store/loop.ts';
import { fakeHttp, fixture } from '../connectors/fake-http.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();
const search: Search = {
  id: 'search-1',
  name: 'Accountant, Lahore',
  titles: ['Accountant'],
  seniority: [],
  experienceYears: { min: 0, max: 10 },
  mustSkills: [],
  niceSkills: [],
  cities: ['lahore'],
  workModes: ['onsite', 'hybrid'],
  employment: ['full-time'],
  nightShiftOk: false,
  skipCompanies: [],
  mode: 'review',
};

describe('identify', () => {
  it('recognises career-site links Job Hunter can fill', () => {
    expect(identify('https://job-boards.greenhouse.io/canonical/jobs/5150422')).toEqual({
      source: 'greenhouse',
      sourceId: 'canonical-5150422',
      applyLevel: 'B',
    });
    expect(identify('https://jobs.lever.co/toptal/ab-12')).toMatchObject({
      source: 'lever',
      sourceId: 'toptal-ab-12',
      applyLevel: 'B',
    });
    expect(identify('https://jobs.ashbyhq.com/supabase/x-1')).toMatchObject({
      source: 'ashby',
      applyLevel: 'B',
    });
  });

  it('names other sites by host or given source, with a stable id', () => {
    const a = identify('https://www.rozee.pk/job/jsearch/accountant-123');
    expect(a).toMatchObject({ source: 'rozee', applyLevel: 'C' });
    expect(identify('https://www.rozee.pk/job/jsearch/accountant-123').sourceId).toBe(a.sourceId);
    expect(identify('https://pk.linkedin.com/jobs/view/1', 'linkedin').source).toBe('linkedin');
  });
});

describe('readJobPage', () => {
  it('reads a page’s job data, and gives up when blocked or empty', async () => {
    const http = fakeHttp({
      'https://www.mustakbil.com/jobs/job/1000001': fixture('mustakbil-job.html'),
      'https://blocked.example/': { status: 'blocked', message: 'x' },
      'https://empty.example/': '<p>no data</p>',
    });
    expect(await readJobPage(http, 'https://www.mustakbil.com/jobs/job/1000001')).toMatchObject({
      title: 'Accountant',
      company: 'Example Traders',
      salaryText: 'PKR 50000 - 55000 per month',
    });
    expect(await readJobPage(http, 'https://blocked.example/1')).toBeUndefined();
    expect(await readJobPage(http, 'https://empty.example/1')).toBeUndefined();
  });
});

describe('addJob', () => {
  it('adds a matching job to today’s list and saves non-matching ones with the reason', async () => {
    const dir = await tempDir();
    await saveSearches(dir, [search]);
    const added = await addJob(dir, {
      url: 'https://www.rozee.pk/job/1',
      title: 'Accountant',
      company: 'Example Traders',
      location: 'Lahore, Pakistan',
      source: 'rozee',
    });
    expect(added).toMatchObject({
      added: true,
      item: { source: 'rozee', applyLevel: 'C', searchId: 'search-1' },
    });
    const karachi = await addJob(dir, {
      url: 'https://www.rozee.pk/job/2',
      title: 'Accountant',
      company: 'Example Foods',
      location: 'Karachi (Onsite)',
      source: 'rozee',
    });
    expect(karachi).toMatchObject({ added: false, reason: 'In karachi (you chose lahore)' });
    const scam = await addJob(dir, {
      url: 'https://www.rozee.pk/job/3',
      title: 'Accountant',
      company: 'X',
      location: 'Lahore',
      description: 'Registration fee Rs 2000. WhatsApp only.',
    });
    expect(scam).toMatchObject({ added: false, reason: 'Looks like a scam' });
    expect((await loadDoc(dir, MATCHES)).items.map((i) => i.title)).toEqual(['Accountant']);
    expect((await loadJobs(dir)).size).toBe(3);
  });
});
