import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../plugin/src/schema/files.ts';
import { DataFileError } from '../../plugin/src/store/json-file.ts';
import { logEvent, readLog } from '../../plugin/src/store/log.ts';
import {
  isPaused,
  loadSettings,
  saveSettings,
  setPaused,
} from '../../plugin/src/store/settings.ts';
import { useTempDir } from './helpers.ts';

const tempDir = useTempDir();

async function logActions(dir: string): Promise<string[]> {
  const actions: string[] = [];
  for await (const event of readLog(dir)) actions.push(event.action);
  return actions;
}

describe('settings', () => {
  it('falls back to defaults when missing', async () => {
    expect(await loadSettings(await tempDir())).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads', async () => {
    const dir = await tempDir();
    await saveSettings(dir, { ...DEFAULT_SETTINGS, usage: 'full' });
    expect((await loadSettings(dir)).usage).toBe('full');
  });

  it('pauses and resumes, logging each change once', async () => {
    const dir = await tempDir();
    await setPaused(dir, true);
    await setPaused(dir, true);
    expect(await isPaused(dir)).toBe(true);
    await setPaused(dir, false);
    expect(await isPaused(dir)).toBe(false);
    expect(await logActions(dir)).toEqual(['paused', 'resumed']);
  });

  it('refuses to guess when settings are damaged with no backup', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'settings.json'), '{"paused": "yes"}', 'utf8');
    await expect(isPaused(dir)).rejects.toBeInstanceOf(DataFileError);
  });
});

describe('log', () => {
  it('stamps events with the time', async () => {
    const dir = await tempDir();
    await logEvent(dir, { actor: 'agent', action: 'hunt', detail: { found: 3 } }, new Date(0));
    const line = JSON.parse(await readFile(join(dir, 'log.jsonl'), 'utf8')) as unknown;
    expect(line).toEqual({
      at: '1970-01-01T00:00:00.000Z',
      actor: 'agent',
      action: 'hunt',
      detail: { found: 3 },
    });
  });
});
