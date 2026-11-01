import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initDataFolder } from '../../plugin/src/store/folder.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

function outreach(
  home: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/outreach.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

describe('outreach CLI', { timeout: 60_000 }, () => {
  it('saves drafts, tracks sent / follow-up, and rejects bad input', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    await writeFile(
      join(home, 'c.json'),
      JSON.stringify([
        {
          id: 'contact-1',
          name: 'Sara Example',
          role: 'Recruiter',
          company: 'ExampleCorp',
          confidence: 'recruiter',
          source: 'web-search',
          jobIds: ['g:1'],
          channel: 'linkedin-note',
          message: 'Hi Sara',
        },
      ]),
    );
    expect(outreach(home, 'save', join(home, 'c.json')).json).toEqual({ saved: 1, problems: [] });
    expect(outreach(home, 'mark', 'contact-1', 'sent').json).toMatchObject({
      status: 'sent',
      sentAt: expect.any(String) as unknown,
    });
    expect(outreach(home, 'followed-up', 'contact-1').json).toHaveProperty('followedUpAt');
    expect(outreach(home, 'list').json).toMatchObject({ followUpsDue: [] });
    expect(outreach(home, 'mark', 'contact-9', 'sent').json).toEqual({ error: 'no such contact' });
    expect(outreach(home, 'mark', 'contact-1', 'maybe').json).toMatchObject({ error: 'usage' });
    expect(outreach(home, 'save').json).toMatchObject({ error: 'usage' });
    expect(outreach(home, 'explode')).toMatchObject({ code: 1 });
  });
});
