import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { folderStatus, initDataFolder } from '../../plugin/src/store/folder.ts';
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  readMeta,
  type Migration,
} from '../../plugin/src/store/migrations.ts';
import { dataDir } from '../../plugin/src/store/paths.ts';
import { useTempDir } from './helpers.ts';

const tempDir = useTempDir();

async function folderAt(version: number): Promise<string> {
  const dir = await tempDir();
  await writeFile(
    join(dir, 'meta.json'),
    JSON.stringify({ schemaVersion: version, createdAt: '2026-10-21T00:00:00.000Z' }),
  );
  return dir;
}

const step = (to: number, calls: number[]): Migration => ({
  to,
  describe: `to v${String(to)}`,
  up: () => {
    calls.push(to);
    return Promise.resolve();
  },
});

describe('dataDir', () => {
  it('defaults to ~/JobHunter and honours JOB_HUNTER_HOME', () => {
    expect(dataDir({})).toMatch(/JobHunter$/);
    expect(dataDir({ JOB_HUNTER_HOME: '/x' })).toBe('/x');
    expect(dataDir({ JOB_HUNTER_HOME: '' })).toMatch(/JobHunter$/);
  });
});

describe('initDataFolder', () => {
  it('creates a private folder with meta, settings and a log entry', async () => {
    const dir = join(await tempDir(), 'JobHunter');
    expect(await initDataFolder(dir, new Date(0))).toEqual({ created: true });
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect(await readMeta(dir)).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: '1970-01-01T00:00:00.000Z',
    });
    expect(await readFile(join(dir, 'log.jsonl'), 'utf8')).toContain('data-folder-created');
  });

  it('is safe to run twice and keeps existing settings', async () => {
    const dir = await tempDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'settings.json'), JSON.stringify({ custom: true }));
    await initDataFolder(dir);
    expect(await readFile(join(dir, 'settings.json'), 'utf8')).toContain('custom');
    expect(await initDataFolder(dir)).toEqual({ created: false });
  });
});

describe('migrate', () => {
  it('reports a folder that is not set up', async () => {
    expect(await migrate(await tempDir())).toEqual({ status: 'not-set-up' });
  });

  it('does nothing when up to date', async () => {
    expect(await migrate(await folderAt(1), [], 1)).toEqual({ status: 'up-to-date', version: 1 });
  });

  it('runs pending migrations in order and records each version', async () => {
    const calls: number[] = [];
    const dir = await folderAt(1);
    const result = await migrate(dir, [step(3, calls), step(2, calls)], 3);
    expect(result).toEqual({ status: 'migrated', from: 1, to: 3, applied: ['to v2', 'to v3'] });
    expect(calls).toEqual([2, 3]);
    expect((await readMeta(dir))?.schemaVersion).toBe(3);
  });

  it('refuses a folder from a newer plugin', async () => {
    expect(await migrate(await folderAt(5), [], 1)).toEqual({
      status: 'too-new',
      version: 5,
      supported: 1,
    });
  });

  it('fails loudly when a migration is missing', async () => {
    await expect(migrate(await folderAt(1), [step(3, [])], 3)).rejects.toThrow(/Missing migration/);
  });

  it('throws on damaged meta', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'meta.json'), '{}');
    await expect(migrate(dir)).rejects.toThrow(/meta.json is damaged/);
  });
});

describe('folderStatus', () => {
  it('reports a missing folder', async () => {
    expect(await folderStatus(join(await tempDir(), 'none'))).toEqual({
      setUp: false,
      files: {},
      problems: [],
    });
  });

  it('lists files and paused state', async () => {
    const dir = await tempDir();
    await initDataFolder(dir);
    const status = await folderStatus(dir);
    expect(status).toMatchObject({
      setUp: true,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      paused: false,
      problems: [],
    });
    expect(status.files).toMatchObject({ meta: true, settings: true, log: true, profile: false });
    expect(status.loop).toEqual({
      searches: 0,
      searchesConfirmed: false,
      answers: 0,
      gapsPending: 0,
      drafts: 0,
      applicationsWaiting: 0,
    });
  });

  it('reports damaged files instead of failing', async () => {
    const dir = await tempDir();
    await initDataFolder(dir);
    await writeFile(join(dir, 'settings.json'), 'oops');
    await writeFile(join(dir, 'settings.json.bak'), 'oops');
    const status = await folderStatus(dir);
    expect(status.paused).toBeUndefined();
    expect(status.problems).toEqual(['settings.json is damaged and has no good backup']);

    await writeFile(join(dir, 'meta.json'), 'oops');
    expect((await folderStatus(dir)).problems).toEqual([
      'meta.json is damaged and has no good backup',
    ]);
  });

  it('reports a damaged loop file without failing', async () => {
    const dir = await tempDir();
    await initDataFolder(dir);
    await writeFile(join(dir, 'gaps.json'), 'oops');
    const status = await folderStatus(dir);
    expect(status.loop).toBeUndefined();
    expect(status.problems).toEqual(['gaps.json is damaged and has no good backup']);
  });
});
