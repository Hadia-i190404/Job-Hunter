// Creating the data folder and summarising its state for the status skill.
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../schema/files.ts';
import { DataFileError, writeJsonAtomic } from './json-file.ts';
import { logEvent } from './log.ts';
import { CURRENT_SCHEMA_VERSION, migrate, readMeta } from './migrations.ts';
import { FILES, type FileKey } from './paths.ts';
import { loadSettings } from './settings.ts';
import { loadDoc } from './doc.ts';
import { ANSWERS, APPLICATIONS, DRAFTS, GAPS, isConfirmed, SEARCHES } from './loop.ts';

// Safe to run more than once: only creates what's missing, never overwrites.
export async function initDataFolder(dir: string, now = new Date()): Promise<{ created: boolean }> {
  // 0o700: only the user can open the folder (spec R9).
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if ((await readMeta(dir)) !== undefined) return { created: false };

  await writeJsonAtomic(join(dir, FILES.meta), {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now.toISOString(),
  });
  if (!(await exists(join(dir, FILES.settings)))) {
    await writeJsonAtomic(join(dir, FILES.settings), DEFAULT_SETTINGS);
  }
  await logEvent(dir, { actor: 'agent', action: 'data-folder-created' }, now);
  return { created: true };
}

interface LoopCounts {
  searches: number;
  searchesConfirmed: boolean;
  answers: number;
  gapsPending: number;
  drafts: number;
  applicationsWaiting: number;
}

export interface FolderStatus {
  setUp: boolean;
  schemaVersion?: number;
  paused?: boolean;
  loop?: LoopCounts;
  files: Partial<Record<FileKey, boolean>>;
  problems: string[];
}

// Counts and file names only: never file contents (spec R9).
export async function folderStatus(dir: string): Promise<FolderStatus> {
  const problems: string[] = [];
  const meta = await readMeta(dir).catch((error: unknown) => {
    problems.push(describe(error));
    return undefined;
  });
  if (meta === undefined) return { setUp: false, files: {}, problems };

  const keys = Object.keys(FILES) as FileKey[];
  const present = await Promise.all(keys.map((key) => exists(join(dir, FILES[key]))));
  const files = Object.fromEntries(keys.map((key, index) => [key, present[index]]));
  const paused = await loadSettings(dir).then(
    (settings) => settings.paused,
    (error: unknown) => {
      problems.push(describe(error));
      return undefined;
    },
  );
  const status: FolderStatus = { setUp: true, schemaVersion: meta.schemaVersion, files, problems };
  if (paused !== undefined) status.paused = paused;
  const loop = await loopCounts(dir).catch((error: unknown) => {
    problems.push(describe(error));
    return undefined;
  });
  if (loop !== undefined) status.loop = loop;
  return status;
}

// Counts only, for the status skill and the daily notification.
async function loopCounts(dir: string): Promise<LoopCounts> {
  const [searches, answers, gaps, drafts, applications] = await Promise.all([
    loadDoc(dir, SEARCHES),
    loadDoc(dir, ANSWERS),
    loadDoc(dir, GAPS),
    loadDoc(dir, DRAFTS),
    loadDoc(dir, APPLICATIONS),
  ]);
  return {
    searches: searches.searches.length,
    searchesConfirmed: isConfirmed(searches),
    answers: answers.answers.length,
    gapsPending: gaps.gaps.filter((gap) => gap.outcome === 'pending').length,
    drafts: drafts.drafts.length,
    applicationsWaiting: applications.applications.filter(
      (a) => a.status === 'prepared' || a.status === 'needs-you',
    ).length,
  };
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function describe(error: unknown): string {
  if (error instanceof DataFileError) return `${error.file} is damaged and has no good backup`;
  return error instanceof Error ? error.message : String(error);
}

export type OpenResult = 'ok' | 'not-set-up' | 'too-new';

// Every command that uses the data folder calls this first: it upgrades an older folder
// (migrations) and refuses one written by a newer plugin.
export async function openDataFolder(dir: string): Promise<OpenResult> {
  const result = await migrate(dir);
  if (result.status === 'not-set-up' || result.status === 'too-new') return result.status;
  return 'ok';
}
