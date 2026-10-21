import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();
const fakeProfile = readFileSync(
  new URL('../fixtures/cv/fake-profile.json', import.meta.url),
  'utf8',
);

function run(
  home: string,
  script: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', `plugin/scripts/${script}`, ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

describe('setup CLI', { timeout: 60_000 }, () => {
  it('runs the interview data flow end to end', async () => {
    const home = await tempDir();
    expect(run(home, 'setup.ts', 'show').json).toEqual({ error: 'not-set-up' });
    run(home, 'store.ts', 'init');
    await writeFile(join(home, 'p.json'), fakeProfile);
    run(home, 'cv.ts', 'save-profile', join(home, 'p.json'));

    // An unapproved claim leaves the profile but is kept as a draft.
    expect(run(home, 'setup.ts', 'to-drafts', 'not mine', 'exp-1-b2', 'skill-3').json).toEqual({
      moved: ['exp-1-b2', 'skill-3'],
      notFound: [],
    });

    // A gap answer becomes a draft, then an approved user fact.
    await writeFile(
      join(home, 'd.json'),
      JSON.stringify([
        {
          id: 'user-1',
          kind: 'experience-bullet',
          parentId: 'exp-1',
          text: 'Presented monthly reports to the client.',
          why: 'gap: client-facing',
        },
      ]),
    );
    expect(run(home, 'setup.ts', 'add-drafts', join(home, 'd.json')).json).toEqual({ added: 1 });
    expect(run(home, 'setup.ts', 'approve', 'user-1', 'nope').json).toEqual({
      moved: ['user-1'],
      notFound: ['nope'],
    });
    expect(run(home, 'setup.ts', 'drop', 'skill-3').json).toEqual({ dropped: 1 });
    expect(
      run(home, 'setup.ts', 'gap', 'client-facing work', 'added', 'user-1').json,
    ).toMatchObject({ outcome: 'added' });

    await writeFile(
      join(home, 's.json'),
      JSON.stringify([
        {
          id: 'search-1',
          name: 'Accountant, Lahore',
          titles: ['Accountant'],
          seniority: ['mid'],
          experienceYears: { min: 1, max: 5 },
          mustSkills: ['QuickBooks'],
          niceSkills: [],
          cities: ['lahore'],
          workModes: ['onsite', 'hybrid'],
          employment: ['full-time'],
          nightShiftOk: false,
          skipCompanies: [],
          mode: 'review',
        },
      ]),
    );
    expect(run(home, 'setup.ts', 'save-searches', join(home, 's.json')).json).toMatchObject({
      saved: 1,
      confirmed: false,
    });
    expect(run(home, 'setup.ts', 'confirm').json).toHaveProperty('confirmedAt');
    await writeFile(
      join(home, 'a.json'),
      JSON.stringify([
        { key: 'notice-period', question: 'Notice?', answer: '1 month', kind: 'fact' },
      ]),
    );
    expect(run(home, 'setup.ts', 'save-answers', join(home, 'a.json')).json).toEqual({
      answers: 1,
    });

    const shown = run(home, 'setup.ts', 'show').json as {
      confirmed: boolean;
      profile: { experience: { bullets: { id: string; source: string }[] }[] };
      drafts: { drafts: { id: string }[] };
    };
    expect(shown.confirmed).toBe(true);
    expect(shown.profile.experience[0]?.bullets.map((b) => [b.id, b.source])).toEqual([
      ['exp-1-b1', 'cv'],
      ['user-1', 'user'],
    ]);
    expect(shown.drafts.drafts.map((d) => d.id)).toEqual(['exp-1-b2']);
  });

  it('rejects bad input and unknown commands', async () => {
    const home = await tempDir();
    run(home, 'store.ts', 'init');
    await writeFile(join(home, 's.json'), JSON.stringify([{ id: 'x' }]));
    expect(run(home, 'setup.ts', 'save-searches', join(home, 's.json'))).toMatchObject({
      code: 1,
      json: { error: 'invalid-searches' },
    });
    expect(run(home, 'setup.ts', 'confirm')).toMatchObject({
      code: 1,
      json: { error: 'No searches to confirm' },
    });
    expect(run(home, 'setup.ts', 'gap', 'x', 'maybe').json).toMatchObject({ error: 'usage' });
    expect(run(home, 'setup.ts', 'to-drafts', 'why', 'x').json).toMatchObject({
      error: expect.stringMatching(/No profile/) as unknown,
    });
    expect(run(home, 'setup.ts', 'explode')).toMatchObject({ code: 1 });
  });
});
