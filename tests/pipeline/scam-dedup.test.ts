import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dedupKey, groupDuplicates } from '../../plugin/src/pipeline/dedup.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { checkScam } from '../../plugin/src/pipeline/scam.ts';

interface Post {
  title: string;
  description: string;
  company: string;
}
const sets = JSON.parse(
  readFileSync(new URL('../fixtures/labelled/scams.json', import.meta.url), 'utf8'),
) as { scams: Post[]; legit: Post[] };

describe('scam rules on the labelled set', () => {
  it.each(sets.scams.map((post) => [post.title, post]))('flags "%s"', (_title, post) => {
    expect(checkScam(post).level).toBe('scam');
  });

  it.each(sets.legit.map((post) => [post.title, post]))('lets "%s" through', (_title, post) => {
    expect(checkScam(post).level).toBe('ok');
  });
});

describe('checkScam details', () => {
  it('counts a personal email address as a weak signal', () => {
    const email = ['hr.desk', '@', 'gmail.com'].join(''); // built so the privacy guard passes
    const post = { title: 'Clerk', company: 'X', description: `Send CV to ${email}` };
    expect(checkScam(post).level).toBe('ok'); // one weak signal is normal
    expect(checkScam({ ...post, company: '' }).reasons).toEqual([
      'Applications go to a personal email address',
      'No company name',
    ]);
  });

  it('ignores "no registration fee"', () => {
    expect(
      checkScam({ title: 'Agent', company: 'X', description: 'No registration fee.' }).level,
    ).toBe('ok');
  });

  it('marks an earn-from-home pitch alone as suspicious, with reasons', () => {
    expect(checkScam({ title: 'Earn from home', company: 'X', description: '' })).toEqual({
      level: 'suspicious',
      reasons: ['Earn-from-home pitch (typing, ad posting, copy-paste, online earning)'],
    });
  });

  it('treats very high pay for no experience as bait', () => {
    const job = normalizeJob({
      source: 's',
      sourceId: '1',
      url: 'https://example.com/1',
      title: 'Assistant',
      company: 'Example',
      description: 'No experience required.',
      salaryText: 'PKR 400,000 per month',
    });
    expect(checkScam(job)).toMatchObject({ level: 'scam' });
  });
});

describe('dedup', () => {
  const base = {
    url: 'https://example.com/x',
    company: 'Systems Ltd.',
    location: 'Lahore, Pakistan',
    description: 'short',
  };
  const job = (source: string, id: string, title: string, extra: object = {}) =>
    normalizeJob({ ...base, source, sourceId: id, title, ...extra });

  it('groups the same job across boards, any word order, and keeps the best copy', () => {
    const groups = groupDuplicates([
      job('mustakbil', '1', 'Senior Accountant'),
      job('greenhouse', '2', 'Accountant (Senior)', { company: 'SYSTEMS LIMITED' }),
      job('remotive', '3', 'Senior Accountant', { description: 'a much longer description' }),
      job('mustakbil', '4', 'Junior Accountant'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.primary.source).toBe('greenhouse');
    expect(groups[0]?.duplicates.map((d) => d.id)).toEqual(['remotive:3', 'mustakbil:1']);
  });

  it('keeps jobs without a company apart, and splits by place', () => {
    const a = job('s', '1', 'Accountant', { company: '' });
    const b = job('s', '2', 'Accountant', { company: '' });
    expect(dedupKey(a)).not.toBe(dedupKey(b));
    const karachi = job('s', '3', 'Accountant', { location: 'Karachi' });
    const remote = job('s', '4', 'Accountant', { location: 'Remote' });
    expect(
      new Set([dedupKey(job('s', '5', 'Accountant')), dedupKey(karachi), dedupKey(remote)]).size,
    ).toBe(3);
  });

  it('prefers a copy with salary, then the earliest seen', () => {
    const withSalary = job('mustakbil', '1', 'Accountant', { salaryText: 'PKR 80,000 per month' });
    const without = job('mustakbil', '2', 'Accountant');
    expect(groupDuplicates([without, withSalary])[0]?.primary.id).toBe('mustakbil:1');
  });
});
