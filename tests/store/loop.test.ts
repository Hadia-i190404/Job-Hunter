import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Search } from '../../plugin/src/schema/loop.ts';
import { loadDoc, saveDoc } from '../../plugin/src/store/doc.ts';
import { initDataFolder, openDataFolder } from '../../plugin/src/store/folder.ts';
import { DataFileError } from '../../plugin/src/store/json-file.ts';
import {
  ANSWERS,
  APPLICATIONS,
  confirmSearches,
  isConfirmed,
  saveSearches,
  SEARCHES,
  upsertAnswers,
} from '../../plugin/src/store/loop.ts';
import { readMeta } from '../../plugin/src/store/migrations.ts';
import { loadProfile } from '../../plugin/src/store/profile.ts';
import { useTempDir } from './helpers.ts';

const tempDir = useTempDir();

const search = (over: Partial<Search> = {}): Search => ({
  id: 'search-1',
  name: 'Frontend, remote',
  titles: ['Frontend Engineer', 'React Developer'],
  seniority: ['mid', 'senior'],
  experienceYears: { min: 2, max: 5 },
  mustSkills: ['React'],
  niceSkills: ['Flutter'],
  cities: [],
  workModes: ['remote'],
  employment: ['full-time'],
  nightShiftOk: false,
  skipCompanies: [],
  mode: 'review',
  ...over,
});

describe('searches and the direction gate', () => {
  it('starts empty and unconfirmed', async () => {
    const file = await loadDoc(await tempDir(), SEARCHES);
    expect(file).toEqual({ version: 1, searches: [] });
    expect(isConfirmed(file)).toBe(false);
  });

  it('confirms, and any edit re-opens the gate', async () => {
    const dir = await tempDir();
    await expect(confirmSearches(dir)).rejects.toThrow(/No searches/);
    await saveSearches(dir, [search()]);
    expect(isConfirmed(await confirmSearches(dir, new Date(0)))).toBe(true);
    const edited = await saveSearches(dir, [
      search({ cities: ['islamabad'], workModes: ['hybrid'] }),
    ]);
    expect(isConfirmed(edited)).toBe(false);
    expect(edited.version).toBe(3);
  });
});

describe('answer bank', () => {
  it('keeps one answer per key, the latest', async () => {
    const dir = await tempDir();
    await upsertAnswers(dir, [
      { key: 'notice-period', question: 'Notice period?', answer: '1 month', kind: 'fact' },
    ]);
    const file = await upsertAnswers(
      dir,
      [
        { key: 'notice-period', question: 'Notice period?', answer: '2 weeks', kind: 'fact' },
        { key: 'gender', question: 'Gender?', answer: 'Prefer not to say', kind: 'demographic' },
      ],
      new Date(0),
    );
    expect(file.answers.map((a) => [a.key, a.answer])).toEqual([
      ['notice-period', '2 weeks'],
      ['gender', 'Prefer not to say'],
    ]);
  });
});

describe('documents', () => {
  it('refuses to save an invalid value', async () => {
    const dir = await tempDir();
    const bad = { applications: [{ id: 'x' }] } as never;
    await expect(saveDoc(dir, APPLICATIONS, bad)).rejects.toBeInstanceOf(DataFileError);
  });

  it('reports a damaged file instead of starting empty', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'answers.json'), '{"answers": "oops"}');
    await expect(loadDoc(dir, ANSWERS)).rejects.toThrow(/answers.json is damaged/);
  });
});

describe('profile v2 migration', () => {
  it('marks every entry of a v1 profile as from the CV', async () => {
    const dir = await tempDir();
    await initDataFolder(dir);
    await writeFile(
      join(dir, 'meta.json'),
      JSON.stringify({ schemaVersion: 1, createdAt: '2026-10-21T00:00:00.000Z' }),
    );
    const v1 = JSON.parse(
      await readFile(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    const strip = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value, (key, v: unknown) => (key === 'source' ? undefined : v)));
    await writeFile(join(dir, 'profile.json'), JSON.stringify(strip(v1)));

    expect(await openDataFolder(dir)).toBe('ok');
    expect((await readMeta(dir))?.schemaVersion).toBe(2);
    const profile = await loadProfile(dir);
    expect(profile?.experience[0]?.bullets[0]?.source).toBe('cv');
    expect(profile?.skills.every((s) => s.source === 'cv')).toBe(true);
  });

  it('upgrades a folder with no profile, and reports missing and too-new folders', async () => {
    const dir = await tempDir();
    await initDataFolder(dir);
    await writeFile(
      join(dir, 'meta.json'),
      JSON.stringify({ schemaVersion: 1, createdAt: '2026-10-21T00:00:00.000Z' }),
    );
    expect(await openDataFolder(dir)).toBe('ok');
    expect(await openDataFolder(join(dir, 'nope'))).toBe('not-set-up');
    await writeFile(
      join(dir, 'meta.json'),
      JSON.stringify({ schemaVersion: 99, createdAt: '2026-10-21T00:00:00.000Z' }),
    );
    expect(await openDataFolder(dir)).toBe('too-new');
  });
});
