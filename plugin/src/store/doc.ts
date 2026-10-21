// One JSON document in the data folder with a schema: missing → empty value, damaged →
// DataFileError (after trying the .bak copy), saves validated and atomic.
import { join } from 'node:path';
import type { Schema } from '../schema/core.ts';
import { DataFileError, readJson, writeJsonAtomic } from './json-file.ts';

export interface Doc<T> {
  file: string;
  schema: Schema<T>;
  empty: () => T;
}

export async function loadDoc<T>(dir: string, doc: Doc<T>): Promise<T> {
  const result = await readJson(join(dir, doc.file), doc.schema);
  if (result.status === 'corrupt') throw new DataFileError(doc.file, result.errors);
  return result.status === 'ok' ? result.value : doc.empty();
}

// Validates before writing so a bug can never save a file the next read rejects.
export async function saveDoc<T>(dir: string, doc: Doc<T>, value: T): Promise<void> {
  const checked = doc.schema(value, doc.file);
  if (!checked.ok) throw new DataFileError(doc.file, checked.errors);
  await writeJsonAtomic(join(dir, doc.file), checked.value);
}
