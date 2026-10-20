import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { number, object } from '../../plugin/src/schema/core.ts';
import { readJson, writeJsonAtomic } from '../../plugin/src/store/json-file.ts';
import { useTempDir } from './helpers.ts';

const counter = object({ count: number() });
const tempDir = useTempDir();

describe('writeJsonAtomic + readJson', () => {
  it('round-trips a value and leaves no temp files', async () => {
    const dir = await tempDir();
    const path = join(dir, 'c.json');
    await writeJsonAtomic(path, { count: 1 });
    expect(await readJson(path, counter)).toEqual({
      status: 'ok',
      value: { count: 1 },
      recoveredFromBackup: false,
    });
    expect(await readdir(dir)).toEqual(['c.json']);
  });

  it('writes files only the user can read', async () => {
    const path = join(await tempDir(), 'c.json');
    await writeJsonAtomic(path, { count: 1 });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('keeps the previous version as .bak', async () => {
    const path = join(await tempDir(), 'c.json');
    await writeJsonAtomic(path, { count: 1 });
    await writeJsonAtomic(path, { count: 2 });
    expect(JSON.parse(await readFile(`${path}.bak`, 'utf8'))).toEqual({ count: 1 });
  });

  it('reports a missing file', async () => {
    expect(await readJson(join(await tempDir(), 'none.json'), counter)).toEqual({
      status: 'missing',
    });
  });

  it('recovers from the backup and keeps the damaged copy', async () => {
    const dir = await tempDir();
    const path = join(dir, 'c.json');
    await writeJsonAtomic(path, { count: 1 });
    await writeJsonAtomic(path, { count: 2 });
    await writeFile(path, '{"count": 2', 'utf8'); // truncated by a crash

    const result = await readJson(path, counter);
    expect(result).toMatchObject({ status: 'ok', value: { count: 1 }, recoveredFromBackup: true });
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ count: 1 });
    const names = await readdir(dir);
    expect(names.some((name) => name.startsWith('c.json.corrupt-'))).toBe(true);
  });

  it('treats a wrong shape as damage', async () => {
    const path = join(await tempDir(), 'c.json');
    await writeFile(path, '{"count": "two"}', 'utf8');
    expect(await readJson(path, counter)).toEqual({
      status: 'corrupt',
      errors: ['value.count: expected a number'],
    });
  });

  it('leaves a damaged file in place when there is no good backup', async () => {
    const path = join(await tempDir(), 'c.json');
    await writeFile(path, 'not json', 'utf8');
    expect(await readJson(path, counter)).toMatchObject({ status: 'corrupt' });
    expect(await readJson(path, counter)).toMatchObject({ status: 'corrupt' });
    expect(await readFile(path, 'utf8')).toBe('not json');
  });

  it('rethrows unexpected read errors', async () => {
    const dir = await tempDir();
    await expect(readJson(dir, counter)).rejects.toThrow(); // a folder, not a file
  });
});
