// Safe JSON files: writes never leave a half-written file, and a damaged file is
// recovered from the last good copy instead of being lost.
import { randomBytes } from 'node:crypto';
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import type { Schema } from '../schema/core.ts';

export type ReadResult<T> =
  | { status: 'ok'; value: T; recoveredFromBackup: false }
  // The damaged file was kept as `quarantinedAs` and replaced by the last good copy.
  | { status: 'ok'; value: T; recoveredFromBackup: true; quarantinedAs: string }
  | { status: 'missing' }
  | { status: 'corrupt'; errors: string[] };

// Thrown when a file is damaged and its backup is no good either.
export class DataFileError extends Error {
  readonly file: string;
  readonly errors: string[];

  constructor(file: string, errors: string[]) {
    super(`${file} is damaged: ${errors.join('; ')}`);
    this.name = 'DataFileError';
    this.file = file;
    this.errors = errors;
  }
}

const backupOf = (path: string): string => `${path}.bak`;

// Write to a temp file, keep the current file as .bak, then rename into place. A rename
// is atomic, so readers see either the old file or the new one, never a mix.
export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flush: true });
  try {
    await copyFile(path, backupOf(path));
  } catch (error) {
    if (!isMissing(error)) {
      await rm(temp, { force: true });
      throw error;
    }
  }
  await rename(temp, path);
}

export async function readJson<T>(path: string, schema: Schema<T>): Promise<ReadResult<T>> {
  const main = await parseFile(path, schema);
  if (main.status !== 'corrupt') return main;

  const backup = await parseFile(backupOf(path), schema);
  // With no good backup the damaged file stays where it is, so every later read keeps
  // reporting it instead of quietly falling back to defaults.
  if (backup.status !== 'ok') return { status: 'corrupt', errors: main.errors };

  const quarantinedAs = await quarantine(path);
  await copyFile(backupOf(path), path);
  return { status: 'ok', value: backup.value, recoveredFromBackup: true, quarantinedAs };
}

async function parseFile<T>(path: string, schema: Schema<T>): Promise<ReadResult<T>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return { status: 'missing' };
    throw error;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: 'corrupt', errors: [`${path}: not valid JSON`] };
  }
  const result = schema(data);
  return result.ok
    ? { status: 'ok', value: result.value, recoveredFromBackup: false }
    : { status: 'corrupt', errors: result.errors };
}

// Keep the damaged file beside the original so nothing is ever silently thrown away.
async function quarantine(path: string): Promise<string> {
  const target = `${path}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await rename(path, target);
  return target;
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
