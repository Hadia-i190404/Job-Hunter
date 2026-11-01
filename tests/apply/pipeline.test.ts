import { describe, expect, it } from 'vitest';
import {
  addApplication,
  pipeline,
  setStatus,
  type Application,
} from '../../plugin/src/apply/applications.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();
const day = (n: number): string => new Date(Date.UTC(2026, 10, n)).toISOString();
const app = (over: Partial<Application>): Application => ({
  id: 'a',
  jobId: 'j',
  searchId: 's',
  status: 'submitted',
  answers: [],
  todo: [],
  preparedAt: day(1),
  updatedAt: day(1),
  jobTitle: 'Engineer',
  company: 'Example',
  ...over,
});

describe('pipeline', () => {
  it('counts by status and lists follow-ups due after the wait, once', () => {
    const apps = [
      app({ id: 'due', submittedAt: day(1) }),
      app({ id: 'recent', submittedAt: day(6) }),
      app({ id: 'done', submittedAt: day(1), followedUpAt: day(9) }),
      app({ id: 'replied', status: 'replied', submittedAt: day(1) }),
      app({ id: 'ready', status: 'prepared' }),
    ];
    const result = pipeline(apps, 7, new Date(Date.UTC(2026, 10, 10)));
    expect(result.counts).toEqual({ submitted: 3, replied: 1, prepared: 1 });
    expect(result.followUpsDue).toEqual([
      { id: 'due', title: 'Engineer', company: 'Example', daysSince: 9 },
    ]);
  });
});

describe('setStatus', () => {
  it('stamps the submitted date once and moves on with news', async () => {
    const dir = await tempDir();
    await addApplication(dir, {
      jobId: 'g:1',
      searchId: 's',
      jobTitle: 'X',
      company: 'Y',
      url: 'https://example.com',
      applyLevel: 'B',
      prepared: { noAi: false, answers: [], todo: [] },
    });
    const submitted = await setStatus(dir, 'app-1', { status: 'submitted', actor: 'agent' });
    expect(submitted.submittedAt).toBeDefined();
    const replied = await setStatus(dir, 'app-1', { status: 'replied', actor: 'user' });
    expect(replied).toMatchObject({ status: 'replied', submittedAt: submitted.submittedAt });
  });
});
