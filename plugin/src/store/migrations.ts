// Upgrades the data folder when a plugin update changes a file's shape. Each migration
// moves the folder up exactly one schema version; they run in order, and meta.json is
// rewritten after each one so an interrupted upgrade resumes where it stopped.
import { join } from 'node:path';
import { metaSchema, type Meta } from '../schema/files.ts';
import { readFile } from 'node:fs/promises';
import { DataFileError, isMissing, readJson, writeJsonAtomic } from './json-file.ts';
import { logEvent } from './log.ts';
import { FILES } from './paths.ts';

export interface Migration {
  to: number;
  describe: string;
  up: (dir: string) => Promise<void>;
}

export const CURRENT_SCHEMA_VERSION = 2;

// Append new migrations here; never edit or reorder a released one.
const MIGRATIONS: readonly Migration[] = [
  { to: 2, describe: 'profile: mark every entry as read from the CV', up: tagProfileSources },
];

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

// v1 → v2 (Slice 1, D16): entries gain `source`. Everything already in a v1 profile came
// through CV import, so it is marked 'cv'; the setup interview's profile check reviews it.
async function tagProfileSources(dir: string): Promise<void> {
  const path = join(dir, FILES.profile);
  let profile: Record<string, unknown>;
  try {
    profile = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  const tag = (entry: unknown): unknown =>
    typeof entry === 'object' && entry !== null && !('source' in entry)
      ? { ...entry, source: 'cv' }
      : entry;
  const tagBullets = (item: unknown): unknown => {
    if (typeof item !== 'object' || item === null) return item;
    const bullets = (item as { bullets?: unknown }).bullets;
    return Array.isArray(bullets) ? { ...item, bullets: bullets.map(tag) } : item;
  };
  const list = (key: string): unknown[] =>
    Array.isArray(profile[key]) ? (profile[key] as unknown[]) : [];
  await writeJsonAtomic(path, {
    ...profile,
    experience: list('experience').map(tagBullets),
    projects: list('projects').map(tagBullets),
    skills: list('skills').map(tag),
    certifications: list('certifications').map(tag),
  });
}
