import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Application } from '../../plugin/src/apply/applications.ts';
import { buildCard } from '../../plugin/src/apply/card.ts';
import { checkProfile } from '../../plugin/src/store/profile.ts';

const checked = checkProfile(
  JSON.parse(
    readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
  ) as unknown,
);
if (!checked.ok) throw new Error('bad fixture');
const profile = checked.profile;
const at = new Date(0).toISOString();
const app: Application = {
  id: 'app-1',
  jobId: 'rozee:abc',
  searchId: 's',
  status: 'needs-you',
  answers: [],
  todo: [],
  preparedAt: at,
  updatedAt: at,
  jobTitle: 'Accountant',
  company: 'Example Foods',
  url: 'https://www.rozee.pk/job/1',
  applyLevel: 'C',
  cvPath: '/cv/Ayesha-CV.pdf',
};
const bank = [
  {
    key: 'notice-period',
    question: 'Notice?',
    answer: '1 month',
    kind: 'fact' as const,
    updatedAt: at,
  },
  {
    key: 'expected-salary-pkr-month',
    question: 'PKR?',
    answer: '150,000',
    kind: 'preference' as const,
    updatedAt: at,
  },
  {
    key: 'expected-salary-usd-month',
    question: 'USD?',
    answer: '1,500',
    kind: 'preference' as const,
    updatedAt: at,
  },
];

describe('buildCard', () => {
  it('gives site-specific steps and copy-ready answers in a sensible order', () => {
    const card = buildCard({
      app,
      source: 'rozee',
      profile,
      bank,
      summary: 'Accountant with 3 years.',
      inPakistan: true,
    });
    expect(card).toMatchObject({
      id: 'app-1',
      title: 'Accountant',
      company: 'Example Foods',
      link: 'https://www.rozee.pk/job/1',
      cvPath: '/cv/Ayesha-CV.pdf',
    });
    expect(card.steps[0]).toMatch(/Rozee applies with your Rozee profile/);
    expect(card.steps.at(-1)).toBe('Submit, then tell Job Hunter "done"');
    expect(card.copy.map((c) => c.label)).toEqual([
      'Full name',
      'Email',
      'LinkedIn',
      'City',
      'Current company',
      'Current title',
      'Notice period',
      'Expected salary (PKR per month)',
      'Summary (paste where a site asks "about you")',
    ]);
    expect(card.copy.find((c) => c.label.startsWith('Expected'))?.text).toBe('150,000');
  });

  it('uses the USD expectation for jobs outside Pakistan and generic steps for unknown sites', () => {
    const card = buildCard({ app, source: 'somesite', profile, bank, inPakistan: false });
    expect(card.copy.find((c) => c.label.startsWith('Expected'))).toEqual({
      label: 'Expected salary (USD per month)',
      text: '1,500',
    });
    expect(card.steps[0]).toBe('Open the link and follow its Apply button');
    expect(card.copy.some((c) => c.label.startsWith('Summary'))).toBe(false);
  });
});
