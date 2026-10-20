// Upgrades the data folder when a plugin update changes a file's shape. Each migration
// moves the folder up exactly one schema version; they run in order, and meta.json is
// rewritten after each one so an interrupted upgrade resumes where it stopped.
import { join } from 'node:path';
import { metaSchema, type Meta } from '../schema/files.ts';
import { DataFileError, readJson, writeJsonAtomic } from './json-file.ts';
import { logEvent } from './log.ts';
import { FILES } from './paths.ts';

export interface Migration {
  to: number;
  describe: string;
  up: (dir: string) => Promise<void>;
}

export const CURRENT_SCHEMA_VERSION = 1;

// Append new migrations here; never edit or reorder a released one.
const MIGRATIONS: readonly Migration[] = [];

export type MigrateResult =
  | { status: 'not-set-up' }
  | { status: 'up-to-date'; version: number }
  | { status: 'migrated'; from: number; to: number; applied: string[] }
  // The folder was written by a newer plugin than this one: refuse to touch it.
  | { status: 'too-new'; version: number; supported: number };

export async function migrate(
  dir: string,
  migrations: readonly Migration[] = MIGRATIONS,
  target = CURRENT_SCHEMA_VERSION,
): Promise<MigrateResult> {
  const meta = await readMeta(dir);
  if (meta === undefined) return { status: 'not-set-up' };
  const from = meta.schemaVersion;
  if (from > target) return { status: 'too-new', version: from, supported: target };
  if (from === target) return { status: 'up-to-date', version: from };

  const pending = pendingMigrations(migrations, from, target);
  const applied: string[] = [];
  for (const migration of pending) {
    // Migrations must run one after another, in order.
    // eslint-disable-next-line no-await-in-loop
    await migration.up(dir);
    // eslint-disable-next-line no-await-in-loop
    await writeJsonAtomic(join(dir, FILES.meta), { ...meta, schemaVersion: migration.to });
    applied.push(migration.describe);
  }
  await logEvent(dir, { actor: 'agent', action: 'migrated', detail: { from, to: target } });
  return { status: 'migrated', from, to: target, applied };
}

export async function readMeta(dir: string): Promise<Meta | undefined> {
  const result = await readJson(join(dir, FILES.meta), metaSchema);
  if (result.status === 'corrupt') throw new DataFileError(FILES.meta, result.errors);
  return result.status === 'ok' ? result.value : undefined;
}

function pendingMigrations(
  migrations: readonly Migration[],
  from: number,
  target: number,
): Migration[] {
  const pending = migrations.filter((m) => m.to > from && m.to <= target);
  pending.sort((a, b) => a.to - b.to);
  const expected = Array.from({ length: target - from }, (_, index) => from + index + 1);
  if (pending.map((m) => m.to).join() !== expected.join()) {
    throw new Error(`Missing migration between schema ${String(from)} and ${String(target)}`);
  }
  return pending;
}
