import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { loadJobs, saveJobs } from '../../plugin/src/store/jobs.ts';
import type { LineReport } from '../../plugin/src/store/jsonl.ts';
import { useTempDir } from './helpers.ts';

const tempDir = useTempDir();
const day = (n: number): Date => new Date(Date.UTC(2026, 9, n));
const job = (id: string, title: string, seen: Date) =>
  normalizeJob(
    { source: 's', sourceId: id, url: `https://example.com/${id}`, title, company: 'Example' },
    seen,
  );

describe('saveJobs / loadJobs', () => {
  it('adds new jobs and refreshes known ones, keeping the first-seen date', async () => {
    const dir = await tempDir();
    expect(await saveJobs(dir, [job('1', 'Accountant', day(1))], day(1))).toEqual({
      added: 1,
      updated: 0,
      dropped: 0,
      total: 1,
    });
    const result = await saveJobs(
      dir,
      [job('1', 'Senior Accountant', day(5)), job('2', 'Clerk', day(5))],
      day(5),
    );
    expect(result).toMatchObject({ added: 1, updated: 1, total: 2 });
    const saved = (await loadJobs(dir)).get('s:1');
    expect(saved).toMatchObject({
      title: 'Senior Accountant',
      firstSeenAt: day(1).toISOString(),
      lastSeenAt: day(5).toISOString(),
    });
  });

  it('drops jobs not seen for 60 days', async () => {
    const dir = await tempDir();
    await saveJobs(dir, [job('old', 'Old', day(1))], day(1));
    const result = await saveJobs(
      dir,
      [job('new', 'New', day(31))],
      new Date(Date.UTC(2026, 11, 15)),
    );
    expect(result).toMatchObject({ dropped: 1, total: 1 });
    expect([...(await loadJobs(dir)).keys()]).toEqual(['s:new']);
  });

  it('skips a damaged line and keeps the rest', async () => {
    const dir = await tempDir();
    await saveJobs(dir, [job('1', 'Accountant', day(1))], day(1));
    const path = join(dir, 'jobs.jsonl');
    await writeFile(path, `${await readFile(path, 'utf8')}{"id":"broken"}\n`);
    const report: LineReport = { valid: 0, skipped: [] };
    expect((await loadJobs(dir, report)).size).toBe(1);
    expect(report.skipped).toHaveLength(1);
  });
});
