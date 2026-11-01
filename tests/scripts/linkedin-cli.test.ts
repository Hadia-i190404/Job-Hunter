import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initDataFolder } from '../../plugin/src/store/folder.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

function linkedin(
  home: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/linkedin.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

describe('linkedin CLI', { timeout: 60_000 }, () => {
  it('saves suggestions as pending, replaces by section, and tracks approval', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    await writeFile(
      join(home, 'a.json'),
      JSON.stringify([
        {
          section: 'headline',
          label: 'Headline',
          before: 'Engineer',
          after: 'Accountant | Payroll, QuickBooks',
          cites: ['exp-1'],
        },
        { section: 'about', label: 'About', after: 'I keep the books.' },
      ]),
    );
    expect(linkedin(home, 'save', join(home, 'a.json')).json).toEqual({ saved: 2 });
    await writeFile(
      join(home, 'b.json'),
      JSON.stringify([{ section: 'headline', label: 'Headline', after: 'Accountant | Payroll' }]),
    );
    linkedin(home, 'save', join(home, 'b.json'));
    expect(linkedin(home, 'mark', 'headline', 'approved').json).toEqual({
      section: 'headline',
      status: 'approved',
    });
    const listed = linkedin(home, 'list').json as {
      sections: { section: string; after: string; status: string }[];
    };
    expect(listed.sections.map((s) => [s.section, s.after, s.status])).toEqual([
      ['about', 'I keep the books.', 'pending'],
      ['headline', 'Accountant | Payroll', 'approved'],
    ]);
    expect(linkedin(home, 'mark', 'nope', 'done').json).toEqual({ error: 'no such section' });
    expect(linkedin(home, 'mark', 'about', 'maybe').json).toMatchObject({ error: 'usage' });
    expect(linkedin(home, 'explode')).toMatchObject({ code: 1 });
  });
});
