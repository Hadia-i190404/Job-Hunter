// Append-only JSON Lines files (log, jobs, assessments). Read line by line so big files
// never load whole into memory. A bad line is skipped and counted, never fatal.
import { createReadStream } from 'node:fs';
import { appendFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { Schema } from '../schema/core.ts';
import { isMissing } from './json-file.ts';

export async function appendJsonLine(path: string, value: unknown): Promise<void> {
  // One appendFile call per line: O_APPEND keeps concurrent small writes whole.
  await appendFile(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

// Rewrite a whole JSONL file atomically (temp file + rename), for files that get updated.
export async function writeJsonLinesAtomic(
  path: string,
  values: readonly unknown[],
): Promise<void> {
  const temp = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  const body = values.map((value) => `${JSON.stringify(value)}\n`).join('');
  await writeFile(temp, body, { mode: 0o600, flush: true });
  await rename(temp, path);
}

export interface LineReport {
  valid: number;
  skipped: { line: number; errors: string[] }[];
}

export async function* readJsonLines<T>(
  path: string,
  schema: Schema<T>,
  report: LineReport = { valid: 0, skipped: [] },
): AsyncGenerator<T> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const text of lines) {
      lineNumber += 1;
      if (text.trim() === '') continue;
      const parsed = parseLine(text, schema);
      if (parsed.ok) {
        report.valid += 1;
        yield parsed.value;
      } else {
        report.skipped.push({ line: lineNumber, errors: parsed.errors });
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

function parseLine<T>(text: string, schema: Schema<T>): ReturnType<Schema<T>> {
  try {
    return schema(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['not valid JSON'] };
  }
}
