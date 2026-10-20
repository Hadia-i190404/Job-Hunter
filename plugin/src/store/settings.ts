import { join } from 'node:path';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '../schema/files.ts';
import { DataFileError, readJson, writeJsonAtomic } from './json-file.ts';
import { logEvent } from './log.ts';
import { FILES } from './paths.ts';

// Missing settings fall back to defaults; damaged settings with no good backup are an
// error, because guessing "not paused" could restart something the user stopped.
export async function loadSettings(dir: string): Promise<Settings> {
  const result = await readJson(join(dir, FILES.settings), settingsSchema);
  switch (result.status) {
    case 'ok':
      return result.value;
    case 'missing':
      return { ...DEFAULT_SETTINGS };
    case 'corrupt':
      throw new DataFileError(FILES.settings, result.errors);
  }
}

export async function saveSettings(dir: string, settings: Settings): Promise<void> {
  await writeJsonAtomic(join(dir, FILES.settings), settings);
}

// Every skill and the daily run check this before doing anything (spec R9, CLAUDE.md rule 8).
export async function isPaused(dir: string): Promise<boolean> {
  return (await loadSettings(dir)).paused;
}

export async function setPaused(dir: string, paused: boolean): Promise<void> {
  const settings = await loadSettings(dir);
  if (settings.paused === paused) return;
  await saveSettings(dir, { ...settings, paused });
  await logEvent(dir, { actor: 'user', action: paused ? 'paused' : 'resumed' });
}
