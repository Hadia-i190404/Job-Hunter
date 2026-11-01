// Hiring-team outreach rules (S2.7, spec R8): one message per person however many jobs,
// connection notes within LinkedIn's limit, one follow-up at most, stop on a reply.
import type { ContactsFile } from '../schema/loop.ts';

type Contact = ContactsFile['contacts'][number];
export type NewContact = Omit<Contact, 'status' | 'updatedAt' | 'sentAt' | 'followedUpAt'>;

// LinkedIn connection notes are capped at 300 characters.
export const NOTE_LIMIT = 300;

export function mergeContacts(
  existing: readonly Contact[],
  incoming: readonly NewContact[],
  now = new Date(),
): { contacts: Contact[]; problems: string[] } {
  const problems: string[] = [];
  const byKey = new Map(existing.map((c) => [personKey(c), c]));
  for (const contact of incoming) {
    if (contact.channel === 'linkedin-note' && contact.message.length > NOTE_LIMIT) {
      problems.push(
        `Message to ${contact.name} is ${String(contact.message.length)} characters; a connection note allows ${String(NOTE_LIMIT)}`,
      );
      continue;
    }
    const key = personKey(contact);
    const known = byKey.get(key);
    // Same person again (another job): one message mentioning all their jobs.
    const jobIds = [...new Set([...(known?.jobIds ?? []), ...contact.jobIds])];
    if (known !== undefined && known.status !== 'drafted') {
      byKey.set(key, { ...known, jobIds });
      continue;
    }
    byKey.set(key, { ...contact, jobIds, status: 'drafted', updatedAt: now.toISOString() });
  }
  return { contacts: [...byKey.values()], problems };
}

export function followUpsDue(
  contacts: readonly Contact[],
  days: number,
  now = new Date(),
): Contact[] {
  const wait = days * 24 * 60 * 60 * 1000;
  return contacts.filter(
    (c) =>
      c.status === 'sent' &&
      c.followedUpAt === undefined &&
      c.sentAt !== undefined &&
      now.getTime() - Date.parse(c.sentAt) >= wait,
  );
}

function personKey(c: { name: string; company: string }): string {
  return `${c.name.toLowerCase().replace(/\s+/g, ' ').trim()}|${c.company.toLowerCase().trim()}`;
}
