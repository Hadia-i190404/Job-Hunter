import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addApplication } from '../../plugin/src/apply/applications.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { initDataFolder } from '../../plugin/src/store/folder.ts';
import { saveJobs } from '../../plugin/src/store/jobs.ts';
import { checkProfile, saveProfile } from '../../plugin/src/store/profile.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

function apply(
  home: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/apply.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

describe('apply CLI', { timeout: 60_000 }, () => {
  it('prepares a card for sites it can’t fill, then tracks it to submitted', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    const checked = checkProfile(
      JSON.parse(
        readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
      ) as unknown,
    );
    if (!checked.ok) throw new Error('bad fixture');
    await saveProfile(home, checked.profile);
    await saveJobs(home, [
      normalizeJob({
        source: 'mustakbil',
        sourceId: '7',
        url: 'https://example.com/7',
        title: 'Accountant',
        company: 'Example Foods',
      }),
    ]);

    expect(apply(home, 'prepare', 'mustakbil:7', '/cv.pdf').json).toMatchObject({
      id: 'app-1',
      status: 'needs-you',
      todo: ['Apply on mustakbil yourself: https://example.com/7 (your tailored CV: /cv.pdf)'],
    });
    expect(apply(home, 'list').json).toMatchObject({
      waiting: [{ id: 'app-1', level: 'C' }],
      submitted: 0,
    });
    expect(apply(home, 'status', 'app-1', 'submitted').json).toEqual({
      id: 'app-1',
      status: 'submitted',
    });
    expect(apply(home, 'list').json).toMatchObject({ waiting: [], submitted: 1 });
    expect(apply(home, 'show', 'app-1').json).toMatchObject({ status: 'submitted' });
  });

  it('gives a fill plan only for approved applications, leaving the CV and to-dos to the user', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    await addApplication(home, {
      jobId: 'g:2',
      searchId: 's',
      jobTitle: 'X',
      company: 'Y',
      url: 'https://example.com/apply',
      applyLevel: 'B',
      cvPath: '/cv.pdf',
      prepared: {
        noAi: false,
        answers: [
          { question: 'First Name', answer: 'Ayesha', from: 'profile' },
          { question: 'Resume/CV', answer: '/cv.pdf', from: 'profile' },
          { question: 'I agree to the privacy notice', from: 'todo' },
        ],
        todo: ['Tick yourself: "I agree to the privacy notice"'],
      },
    });
    expect(apply(home, 'plan', 'app-1').json).toEqual({
      error: 'not-approved',
      status: 'needs-you',
    });
    apply(home, 'status', 'app-1', 'approved');
    expect(apply(home, 'plan', 'app-1').json).toEqual({
      id: 'app-1',
      url: 'https://example.com/apply',
      fill: [{ field: 'First Name', value: 'Ayesha' }],
      userDoes: [
        'Attach your CV: /cv.pdf',
        'Tick yourself: "I agree to the privacy notice"',
        'Press Submit',
      ],
    });
    expect(apply(home, 'plan', 'app-9').json).toEqual({ error: 'no such application' });
  });

  it('keeps Claude out of no-AI forms and rejects bad input', async () => {
    const home = await tempDir();
    await initDataFolder(home);
    await addApplication(home, {
      jobId: 'g:1',
      searchId: 's',
      jobTitle: 'X',
      company: 'Y',
      url: 'https://example.com',
      applyLevel: 'B',
      prepared: {
        noAi: true,
        answers: [{ question: 'Describe a project', from: 'todo' }],
        todo: ['Write in your own words: "Describe a project"'],
      },
    });
    expect(apply(home, 'answer', 'app-1', '0', 'claude', 'drafted').json).toEqual({
      error: 'no-ai-form',
    });
    expect(apply(home, 'answer', 'app-1', '0', 'user', 'My own words').json).toMatchObject({
      status: 'prepared',
      todo: [],
    });
    expect(apply(home, 'answer', 'app-1', 'x', 'user', 'y').json).toMatchObject({ error: 'usage' });
    expect(apply(home, 'status', 'app-1', 'done').json).toMatchObject({ error: 'usage' });
    expect(apply(home, 'prepare', 'nope', '/cv.pdf').json).toEqual({ error: 'no such job' });
    expect(apply(home, 'prepare').json).toMatchObject({ error: 'usage' });
    expect(apply(home, 'show', 'app-9').json).toEqual({ error: 'no such application' });
    expect(apply(home, 'explode')).toMatchObject({ code: 1 });
  });
});
