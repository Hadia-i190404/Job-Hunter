import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { number, object } from '../../plugin/src/schema/core.ts';
import { appendJsonLine, readJsonLines, type LineReport } from '../../plugin/src/store/jsonl.ts';
import { useTempDir } from './helpers.ts';

const row = object({ n: number() });
const tempDir = useTempDir();

async function collect(path: string, report?: LineReport): Promise<unknown[]> {
  const rows: unknown[] = [];
  for await (const value of readJsonLines(path, row, report)) rows.push(value);
  return rows;
}

describe('JSON Lines', () => {
  it('appends and reads back in order', async () => {
    const path = join(await tempDir(), 'r.jsonl');
    await appendJsonLine(path, { n: 1 });
    await appendJsonLine(path, { n: 2 });
    expect(await collect(path)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('skips and reports bad lines without failing', async () => {
    const path = join(await tempDir(), 'r.jsonl');
    await writeFile(path, '{"n":1}\n\nnot json\n{"n":"x"}\n{"n":3}\n', 'utf8');
    const report: LineReport = { valid: 0, skipped: [] };
    expect(await collect(path, report)).toEqual([{ n: 1 }, { n: 3 }]);
    expect(report.valid).toBe(2);
    expect(report.skipped.map((s) => s.line)).toEqual([3, 4]);
  });

  it('reads a missing file as empty', async () => {
    expect(await collect(join(await tempDir(), 'none.jsonl'))).toEqual([]);
  });

  it('rethrows unexpected errors', async () => {
    const dir = await tempDir();
    await expect(collect(dir)).rejects.toThrow();
  });
});
