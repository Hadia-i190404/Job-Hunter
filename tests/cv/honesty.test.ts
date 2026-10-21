import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkHonesty, experienceYears } from '../../plugin/src/cv/honesty.ts';
import { applyTailoring, keywordCoverage } from '../../plugin/src/cv/tailor.ts';
import type { Profile } from '../../plugin/src/schema/profile.ts';
import type { Tailored } from '../../plugin/src/schema/tailored.ts';
import { checkProfile } from '../../plugin/src/store/profile.ts';

const checked = checkProfile(
  JSON.parse(
    readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
  ) as unknown,
);
if (!checked.ok) throw new Error('bad fixture');
const profile: Profile = checked.profile;
const now = new Date('2026-10-22T00:00:00Z');

const good: Tailored = {
  jobId: 'mustakbil:1',
  headline: 'Accountant | Payroll and QuickBooks',
  summary: 'Accountant with 3 years in bookkeeping, payroll and monthly closing.',
  experience: [
    {
      roleId: 'exp-1',
      bullets: [
        { text: 'Ran monthly payroll for 60 staff using QuickBooks.', cites: ['exp-1-b2'] },
        {
          text: 'Closed the books monthly with reconciliations across 4 bank accounts.',
          cites: ['exp-1-b1'],
        },
      ],
    },
  ],
  projects: [],
  skills: [
    { text: 'QuickBooks', cites: ['skill-1'] },
    { text: 'Payroll', cites: ['skill-3'] },
  ],
  educationIds: ['edu-1'],
  certificationIds: ['cert-1'],
  languages: true,
};

const problems = (t: Tailored, clients: string[] = []): string[] =>
  checkHonesty(t, profile, clients).problems;
const withBullet = (text: string, cites: string[], roleId = 'exp-1'): Tailored => ({
  ...good,
  experience: [{ roleId, bullets: [{ text, cites }] }],
});

describe('checkHonesty', () => {
  it('accepts reworded, correctly cited facts', () => {
    expect(problems(good)).toEqual([]);
  });

  it('rejects lines that cite nothing or another role’s bullet', () => {
    expect(problems(withBullet('Did things.', []))[0]).toMatch(/cites nothing/);
    expect(problems(withBullet('Tracked expenses.', ['exp-2-b1']))[0]).toMatch(
      /isn't a bullet of Accountant/,
    );
  });

  it('rejects new or inflated figures, and accepts the real ones', () => {
    expect(problems(withBullet('Ran payroll for 80 staff.', ['exp-1-b2']))).toEqual([
      expect.stringMatching(/figure 80/) as unknown,
    ]);
    expect(problems(withBullet('Cut closing time 30%.', ['exp-1-b1']))[0]).toMatch(/figure 30%/);
    expect(problems(withBullet('Payroll for 60+ staff.', ['exp-1-b2']))).toEqual([]);
  });

  it('rejects unknown roles, projects, education and certifications', () => {
    const t: Tailored = {
      ...good,
      experience: [{ roleId: 'exp-9', bullets: [] }],
      projects: [{ projectId: 'proj-9', bullets: [] }],
      educationIds: ['edu-9'],
      certificationIds: ['cert-9'],
    };
    expect(problems(t)).toEqual([
      "Experience exp-9 isn't in the profile",
      "Project proj-9 isn't in the profile",
      "Education edu-9 isn't in the profile",
      "Certification cert-9 isn't in the profile",
    ]);
  });

  it('rejects skills the profile doesn’t name', () => {
    const t: Tailored = {
      ...good,
      skills: [
        { text: 'SAP', cites: ['skill-1'] },
        { text: 'Excel', cites: [] },
      ],
    };
    expect(problems(t)).toEqual([
      'Skill "SAP" isn\'t named in skill-1',
      'Skill "Excel" cites nothing in the profile',
    ]);
  });

  it('checks the headline and summary: no new figures, no inflated years', () => {
    expect(problems({ ...good, summary: 'Saved the company 2 million rupees.' })[0]).toMatch(
      /figure 2/,
    );
    const years = experienceYears(profile, now);
    expect(
      problems({ ...good, summary: `Accountant with ${String(years + 4)} years.` }).at(-1),
    ).toMatch(/Claims/);
  });

  it('rejects client names (D17)', () => {
    const named = { ...good, summary: 'Ran payroll for Acme Bank.' };
    expect(problems(named, ['Acme Bank'])).toEqual([
      'Names the client "Acme Bank" (D17: describe the client by type)',
    ]);
    expect(problems(good, ['  '])).toEqual([]);
  });

  it('counts experience from the first role to now, never double-counting', () => {
    expect(experienceYears(profile, now)).toBe(5);
    expect(experienceYears({ ...profile, experience: [] }, now)).toBe(0);
  });
});

describe('applyTailoring', () => {
  it('keeps only chosen facts, in the chosen order and wording', () => {
    const out = applyTailoring(profile, { ...good, languages: false });
    expect(out.headline).toBe('Accountant | Payroll and QuickBooks');
    expect(out.experience.map((e) => e.id)).toEqual(['exp-1']);
    expect(out.experience[0]?.bullets.map((b) => b.text)).toEqual([
      'Ran monthly payroll for 60 staff using QuickBooks.',
      'Closed the books monthly with reconciliations across 4 bank accounts.',
    ]);
    expect(out.skills.map((s) => s.name)).toEqual(['QuickBooks', 'Payroll']);
    expect(out.languages).toEqual([]);
    expect(
      applyTailoring(profile, {
        ...good,
        experience: [{ roleId: 'nope', bullets: [] }],
        projects: [{ projectId: 'nope', bullets: [] }],
      }).experience,
    ).toEqual([]);
  });
});

describe('keywordCoverage', () => {
  it('splits job keywords into covered, true-but-missing, and gaps', () => {
    const job = 'We need QuickBooks, MS Excel, Payroll and SAP experience.';
    expect(keywordCoverage(job, 'QuickBooks and Payroll', profile, ['SAP'])).toEqual({
      covered: ['QuickBooks', 'Payroll'],
      missingButTrue: ['MS Excel'],
      gaps: ['SAP'],
    });
  });
});
