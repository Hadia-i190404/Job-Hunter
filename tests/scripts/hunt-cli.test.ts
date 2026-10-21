import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { saveDoc } from '../../plugin/src/store/doc.ts';
import { initDataFolder } from '../../plugin/src/store/folder.ts';
import { MATCHES } from '../../plugin/src/store/loop.ts';
import { setPaused } from '../../plugin/src/store/settings.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

function hunt(
  home: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/hunt.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

const item = (jobId: string, score: number) => ({
  jobId,
  searchId: 'search-1',
  score,
  fit: 'good' as const,
  reasons: [],
  verdict: 'unclear' as const,
  verdictReasons: [],
  needsClaude: true,
  scam: 'ok' as const,
  title: 'Engineer',
  company: 'Example',
  location: 'Remote, EMEA',
  url: 'https://example.com/x',
  source: 'greenhouse',
  applyLevel: 'B' as const,
});

describe('hunt CLI', { timeout: 60_000 }, () => {
  it('refuses to run before setup is confirmed, and while paused', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    expect(hunt(home, 'run')).toMatchObject({ code: 1, json: { error: 'not-confirmed' } });
    await setPaused(home, true);
    expect(hunt(home, 'run').json).toEqual({ paused: true });
  });

  it('records Claude’s verdicts on unclear jobs', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    await saveDoc(home, MATCHES, {
      runAt: new Date(0).toISOString(),
      items: [item('a', 80), item('b', 60)],
    });
    expect(hunt(home, 'judge', 'a', 'eligible', '"Hiring', 'anywhere"').json).toEqual({
      jobId: 'a',
      verdict: 'eligible',
      remaining: 2,
    });
    expect(hunt(home, 'judge', 'b', 'not-eligible', 'US only').json).toEqual({
      jobId: 'b',
      verdict: 'not-eligible',
      remaining: 1,
    });
    const listed = hunt(home, 'list').json as {
      items: { verdictReasons: string[]; needsClaude: boolean }[];
    };
    expect(listed.items[0]).toMatchObject({
      needsClaude: false,
      verdictReasons: ['"Hiring anywhere" (checked by Claude)'],
    });
    expect(hunt(home, 'judge', 'zzz', 'eligible', 'x').json).toEqual({
      error: 'not in today’s list',
    });
    expect(hunt(home, 'judge', 'a', 'maybe', 'x').json).toMatchObject({ error: 'usage' });
    expect(hunt(home, 'job', 'nope').json).toEqual({ error: 'no such job' });
    expect(hunt(home, 'explode')).toMatchObject({ code: 1 });
  });
});
