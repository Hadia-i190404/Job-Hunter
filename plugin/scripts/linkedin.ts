// LinkedIn rewrite suggestions (S2.6). Prints one JSON object.
// Usage: sh run.sh linkedin.ts <command>
//   save <sections.json>                  [{section, label, before, after, cites}] → pending
//   list                                  all sections with their status
//   mark <section> <approved|done|skipped>
import { readFile } from 'node:fs/promises';
import { loadDoc, saveDoc } from '../src/store/doc.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { logEvent } from '../src/store/log.ts';
import { LINKEDIN } from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';

const dir = dataDir();
const [command = '', ...args] = process.argv.slice(2);
const MARKS = ['approved', 'done', 'skipped'] as const;

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  if (command === 'save' && args[0] !== undefined) return save(args[0]);
  if (command === 'list') return loadDoc(dir, LINKEDIN);
  if (command === 'mark') return mark(args[0], args[1]);
  return {
    error: 'usage',
    commands: 'save <file> | list | mark <section> <approved|done|skipped>',
  };
}

// New suggestions replace older ones for the same section and start as pending.
async function save(path: string): Promise<unknown> {
  const incoming = JSON.parse(await readFile(path, 'utf8')) as {
    section: string;
    label: string;
    before?: string;
    after: string;
    cites?: string[];
  }[];
  const file = await loadDoc(dir, LINKEDIN);
  const now = new Date().toISOString();
  const fresh = incoming.map((s) => ({
    section: s.section,
    label: s.label,
    before: s.before ?? '',
    after: s.after,
    cites: s.cites ?? [],
    status: 'pending' as const,
    updatedAt: now,
  }));
  const keep = file.sections.filter((s) => !fresh.some((f) => f.section === s.section));
  await saveDoc(dir, LINKEDIN, { sections: [...keep, ...fresh] });
  return { saved: fresh.length };
}

async function mark(section: string | undefined, status: string | undefined): Promise<unknown> {
  const value = MARKS.find((m) => m === status);
  if (section === undefined || value === undefined)
    return { error: 'usage', usage: 'mark <section> <approved|done|skipped>' };
  const file = await loadDoc(dir, LINKEDIN);
  if (!file.sections.some((s) => s.section === section)) return { error: 'no such section' };
  const now = new Date().toISOString();
  await saveDoc(dir, LINKEDIN, {
    sections: file.sections.map((s) =>
      s.section === section ? { ...s, status: value, updatedAt: now } : s,
    ),
  });
  await logEvent(dir, { actor: 'user', action: `linkedin-${value}`, detail: { section } });
  return { section, status: value };
}

run().then(
  (result) => {
    console.log(JSON.stringify(result, null, 2));
    if (typeof result === 'object' && result !== null && 'error' in result) process.exitCode = 1;
  },
  (error: unknown) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  },
);
