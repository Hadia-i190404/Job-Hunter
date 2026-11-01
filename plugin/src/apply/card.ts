// Action cards (S2.4): everything the user needs to apply on a site Job Hunter doesn't
// fill (level C), ready to copy, in the order those sites usually ask.
import type { AnswersFile } from '../schema/loop.ts';
import type { Profile } from '../schema/profile.ts';
import type { Application } from './applications.ts';

export interface Card {
  id: string;
  title: string;
  company: string;
  link: string;
  cvPath?: string;
  steps: string[];
  copy: { label: string; text: string }[];
}

// How each site usually works, so the user knows what to expect.
const SITE_STEPS: Record<string, string[]> = {
  rozee: [
    'Rozee applies with your Rozee profile: upload this tailored CV to your Rozee profile first if it isn’t there',
    'Open the link and press Apply',
  ],
  linkedin: [
    'Open the link; use Easy Apply if offered',
    'Upload this tailored CV instead of your default one',
  ],
  indeed: ['Open the link and press Apply', 'Upload this tailored CV when asked'],
  mustakbil: [
    'Open the link and press Apply (sign in to Mustakbil if asked)',
    'Upload this tailored CV',
  ],
};
const DEFAULT_STEPS = [
  'Open the link and follow its Apply button',
  'Upload this tailored CV when asked',
];

type Bank = AnswersFile['answers'];

export function buildCard(input: {
  app: Application;
  source: string;
  profile: Profile;
  bank: Bank;
  summary?: string;
  inPakistan: boolean;
}): Card {
  const { app, source, profile, bank, summary, inPakistan } = input;
  const answer = (key: string): string | undefined => bank.find((a) => a.key === key)?.answer;
  const salaryKey = inPakistan ? 'expected-salary-pkr-month' : 'expected-salary-usd-month';
  const fields: (readonly [string, string | undefined])[] = [
    ['Full name', profile.name],
    ['Email', profile.contact.email],
    ['Phone', profile.contact.phone],
    ['LinkedIn', profile.contact.links.find((l) => /linkedin\.com/i.test(l))],
    ['City', profile.contact.city],
    ['Current company', profile.experience.find((e) => e.end === 'present')?.company],
    ['Current title', profile.experience.find((e) => e.end === 'present')?.title],
    ['Years of experience', answer('years-experience')],
    ['Notice period', answer('notice-period')],
    [`Expected salary (${inPakistan ? 'PKR' : 'USD'} per month)`, answer(salaryKey)],
    ['Earliest start', answer('earliest-start')],
    ['Summary (paste where a site asks "about you")', summary],
  ];
  const card: Card = {
    id: app.id,
    title: app.jobTitle ?? '',
    company: app.company ?? '',
    link: app.url ?? '',
    steps: [
      ...(SITE_STEPS[source] ?? DEFAULT_STEPS),
      'Paste the answers below where asked',
      'Submit, then tell Job Hunter "done"',
    ],
    copy: fields
      .filter((f): f is readonly [string, string] => f[1] !== undefined && f[1] !== '')
      .map(([label, text]) => ({ label, text })),
  };
  if (app.cvPath !== undefined) card.cvPath = app.cvPath;
  return card;
}
