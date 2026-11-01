import { describe, expect, it } from 'vitest';
import {
  followUpsDue,
  mergeContacts,
  NOTE_LIMIT,
  type NewContact,
} from '../../plugin/src/apply/outreach.ts';

const base: NewContact = {
  id: 'contact-1',
  name: 'Sara Example',
  role: 'Recruiter',
  company: 'ExampleCorp',
  confidence: 'recruiter',
  source: 'web-search',
  jobIds: ['g:1'],
  channel: 'linkedin-note',
  message: 'Hi Sara, I applied for the Frontend role on 1 Nov.',
};
const day = (n: number): Date => new Date(Date.UTC(2026, 10, n));

describe('mergeContacts', () => {
  it('keeps one message per person, adding their other jobs', () => {
    const first = mergeContacts([], [base], day(1)).contacts;
    const again = mergeContacts(
      first,
      [{ ...base, id: 'contact-2', name: 'sara  example', jobIds: ['g:2'] }],
      day(2),
    );
    expect(again.contacts).toHaveLength(1);
    expect(again.contacts[0]).toMatchObject({ status: 'drafted', jobIds: ['g:1', 'g:2'] });
  });

  it('never redrafts a message already sent, but records the new job', () => {
    const sent = [
      {
        ...base,
        status: 'sent' as const,
        sentAt: day(1).toISOString(),
        updatedAt: day(1).toISOString(),
      },
    ];
    const merged = mergeContacts(sent, [{ ...base, jobIds: ['g:3'], message: 'new words' }])
      .contacts[0];
    expect(merged).toMatchObject({ status: 'sent', message: base.message, jobIds: ['g:1', 'g:3'] });
  });

  it('refuses connection notes over LinkedIn’s 300-character limit', () => {
    const long = { ...base, message: 'x'.repeat(NOTE_LIMIT + 1) };
    expect(mergeContacts([], [long]).problems[0]).toMatch(
      /301 characters; a connection note allows 300/,
    );
    expect(mergeContacts([], [{ ...long, channel: 'email' }]).problems).toEqual([]);
  });
});

describe('followUpsDue', () => {
  it('lists sent messages past the wait, once, and never after a reply', () => {
    const contacts = [
      { ...base, id: 'a', status: 'sent' as const, sentAt: day(1).toISOString(), updatedAt: '' },
      { ...base, id: 'b', status: 'sent' as const, sentAt: day(8).toISOString(), updatedAt: '' },
      {
        ...base,
        id: 'c',
        status: 'sent' as const,
        sentAt: day(1).toISOString(),
        followedUpAt: day(9).toISOString(),
        updatedAt: '',
      },
      { ...base, id: 'd', status: 'replied' as const, sentAt: day(1).toISOString(), updatedAt: '' },
    ];
    expect(followUpsDue(contacts, 7, day(10)).map((c) => c.id)).toEqual(['a']);
  });
});
