import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findChrome } from '../../plugin/src/cv/chrome.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { initDataFolder } from '../../plugin/src/store/folder.ts';
import { saveJobs } from '../../plugin/src/store/jobs.ts';
import { checkProfile, saveProfile } from '../../plugin/src/store/profile.ts';
import { loadDoc } from '../../plugin/src/store/doc.ts';
import { GAPS } from '../../plugin/src/store/loop.ts';
import { useTempDir } from '../store/helpers.ts';

const tempDir = useTempDir();

function tailor(
  home: string,
  ...args: string[]
): { code: number | null; json: Record<string, unknown> } {
  const result = spawnSync('sh', ['plugin/scripts/run.sh', 'plugin/scripts/tailor.ts', ...args], {
    encoding: 'utf8',
    env: { ...process.env, JOB_HUNTER_HOME: home },
  });
  return { code: result.status, json: JSON.parse(result.stdout) as Record<string, unknown> };
}

async function home(): Promise<string> {
  const dir = await tempDir();
  await initDataFolder(dir);
  const checked = checkProfile(
    JSON.parse(
      readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
    ) as unknown,
  );
  if (!checked.ok) throw new Error('bad fixture');
  await saveProfile(dir, checked.profile);
  const job = normalizeJob({
    source: 'mustakbil',
    sourceId: '1',
    url: 'https://example.com/1',
    title: 'Accountant',
    company: 'Example Foods',
    location: 'Lahore',
    description: 'QuickBooks, Payroll and SAP required.',
  });
  await saveJobs(dir, [job]);
  return dir;
}

const tailored = (bulletText: string) => ({
  jobId: 'mustakbil:1',
  headline: 'Accountant',
  summary: 'Accountant focused on payroll.',
  experience: [{ roleId: 'exp-1', bullets: [{ text: bulletText, cites: ['exp-1-b2'] }] }],
  projects: [],
  skills: [{ text: 'QuickBooks', cites: ['skill-1'] }],
  educationIds: ['edu-1'],
  certificationIds: [],
  languages: false,
});

describe('tailor CLI', { timeout: 90_000 }, () => {
  it('gives Claude the context, and refuses an untrue CV', async () => {
    const dir = await home();
    expect(tailor(dir, 'context', 'mustakbil:1').json).toMatchObject({
      job: { title: 'Accountant' },
      match: null,
    });
    expect(tailor(dir, 'context', 'nope').json).toEqual({ error: 'no such job' });
    await writeFile(join(dir, 't.json'), JSON.stringify(tailored('Ran payroll for 600 staff.')));
    expect(tailor(dir, 'render', join(dir, 't.json'))).toMatchObject({
      code: 1,
      json: { error: 'honesty' },
    });
    await writeFile(join(dir, 'bad.json'), '{}');
    expect(tailor(dir, 'render', join(dir, 'bad.json')).json).toMatchObject({
      error: 'invalid-tailored',
    });
    expect(tailor(dir, 'explode').json).toMatchObject({ error: 'usage' });
  });

  it('prints a true CV, reports keyword coverage and records gaps', async () => {
    if ((await findChrome()) === undefined) return; // no browser on this machine
    const dir = await home();
    await writeFile(
      join(dir, 't.json'),
      JSON.stringify(tailored('Ran monthly payroll for 60 staff in QuickBooks.')),
    );
    const out = tailor(dir, 'render', join(dir, 't.json')).json;
    expect(out).toMatchObject({
      pages: 1,
      tooLong: false,
      coverage: { covered: ['QuickBooks', 'Payroll'], gaps: [] },
    });
    expect(String(out.pdf)).toMatch(/Ayesha-Example-CV-Example-Foods\.pdf$/);
    // SAP is in the job but not in the profile's vocabulary, so it isn't a known gap term.
    expect((await loadDoc(dir, GAPS)).gaps).toEqual([]);
  });
});
