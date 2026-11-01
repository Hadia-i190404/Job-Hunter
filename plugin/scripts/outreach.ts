// Hiring-team messages (S2.7). Prints one JSON object.
// Usage: sh run.sh outreach.ts <command>
//   save <contacts.json>                 [{id, name, role, company, url?, confidence, source, jobIds, channel, message}]
//   list                                 all contacts + follow-ups due
//   mark <id> <sent|replied|skipped>
//   followed-up <id>
import { readFile } from 'node:fs/promises';
import { followUpsDue, mergeContacts, type NewContact } from '../src/apply/outreach.ts';
import { loadDoc, saveDoc } from '../src/store/doc.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { logEvent } from '../src/store/log.ts';
import { CONTACTS } from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';
import { loadSettings } from '../src/store/settings.ts';

const dir = dataDir();
const [command = '', ...args] = process.argv.slice(2);
const MARKS = ['sent', 'replied', 'skipped'] as const;

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  switch (command) {
    case 'save':
      return save(args[0]);
    case 'list': {
      const [file, settings] = await Promise.all([loadDoc(dir, CONTACTS), loadSettings(dir)]);
      return {
        contacts: file.contacts,
        followUpsDue: followUpsDue(file.contacts, settings.followUpDays).map((c) => c.id),
      };
    }
    case 'mark':
      return mark(args[0], args[1]);
    case 'followed-up':
      return change(args[0], { followedUpAt: new Date().toISOString() });
    default:
      return {
        error: 'usage',
        commands: 'save <file> | list | mark <id> <sent|replied|skipped> | followed-up <id>',
      };
  }
}

async function save(path: string | undefined): Promise<unknown> {
  if (path === undefined) return { error: 'usage', usage: 'save <contacts.json>' };
  const incoming = JSON.parse(await readFile(path, 'utf8')) as NewContact[];
  const file = await loadDoc(dir, CONTACTS);
  const { contacts, problems } = mergeContacts(file.contacts, incoming);
  await saveDoc(dir, CONTACTS, { contacts });
  return { saved: incoming.length - problems.length, problems };
}

async function mark(id: string | undefined, status: string | undefined): Promise<unknown> {
  const value = MARKS.find((m) => m === status);
  if (id === undefined || value === undefined)
    return { error: 'usage', usage: 'mark <id> <sent|replied|skipped>' };
  const result = await change(id, {
    status: value,
    ...(value === 'sent' ? { sentAt: new Date().toISOString() } : {}),
  });
  await logEvent(dir, { actor: 'user', action: `outreach-${value}`, detail: { id } });
  return result;
}

async function change(id: string | undefined, patch: Record<string, string>): Promise<unknown> {
  const file = await loadDoc(dir, CONTACTS);
  if (id === undefined || !file.contacts.some((c) => c.id === id))
    return { error: 'no such contact' };
  const now = new Date().toISOString();
  const contacts = file.contacts.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now } : c));
  await saveDoc(dir, CONTACTS, { contacts });
  return contacts.find((c) => c.id === id);
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
