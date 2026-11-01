import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyBlocks, renderCvHtml } from '../../plugin/src/cv/render.ts';
import { checkQuality, pageTarget, professionalYears } from '../../plugin/src/cv/quality.ts';
import { applyTailoring } from '../../plugin/src/cv/tailor.ts';
import type { Profile } from '../../plugin/src/schema/profile.ts';
import type { Tailored } from '../../plugin/src/schema/tailored.ts';
import { checkProfile } from '../../plugin/src/store/profile.ts';

const checked = checkProfile(
  JSON.parse(
    readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
  ) as unknown,
);
if (!checked.ok) throw new Error('bad fixture');
const base: Profile = checked.profile;
const [role1, role2] = base.experience;
const [edu1] = base.education;
if (role1 === undefined || role2 === undefined || edu1 === undefined)
  throw new Error('bad fixture');
// The same company twice in a row, like a promotion.
const promoted: Profile = {
  ...base,
  experience: [
    {
      ...role1,
      id: 'exp-1',
      title: 'Senior Accountant',
      company: 'Example Traders',
      start: '2025-01',
      end: 'present',
    },
    {
      ...role1,
      id: 'exp-1b',
      title: 'Accountant',
      company: 'Example Traders',
      start: '2023-02',
      end: '2024-12',
      bullets: [{ id: 'b-x', text: 'Kept the books.', source: 'cv' }],
    },
    { ...role2, title: 'Accounting Intern', start: '2021-07', end: '2023-01' },
  ],
  education: [{ ...edu1, details: 'CGPA 3.3' }],
};

const tailored = (over: Partial<Tailored> = {}): Tailored => ({
  jobId: 'x:1',
  headline: 'Accountant',
  summary: 'Accountant with payroll experience. Runs month-end close.',
  experience: [
    { roleId: 'exp-1', bullets: [{ text: 'Ran payroll for 60 staff.', cites: ['exp-1-b2'] }] },
  ],
  projects: [],
  skills: base.skills.map((s) => ({ text: s.name, cites: [s.id] })),
  educationIds: ['edu-1'],
  certificationIds: [],
  languages: false,
  ...over,
});

describe('renderer layout (D23)', () => {
  const html = renderCvHtml(promoted, '');

  it('combines consecutive roles at one company under one heading with the full span', () => {
    expect(companyBlocks(promoted.experience).map((b) => [b.company, b.roles.length])).toEqual([
      ['Example Traders', 2],
      ['Example Builders', 1],
    ]);
    expect(html).toMatch(
      /<h3>Example Traders, Lahore<\/h3>\s*<p class="dates">Feb 2023 – Present<\/p>/,
    );
    expect(html).toContain(
      '<h4>Senior Accountant <span class="dates">· Jan 2025 – Present</span></h4>',
    );
  });

  it('makes email and links clickable', () => {
    expect(html).toContain('<a href="mailto:ayesha@example.com">ayesha@example.com</a>');
    expect(html).toContain(
      '<a href="https://linkedin.com/in/ayesha-example">linkedin.com/in/ayesha-example</a>',
    );
  });

  it('groups skills when they carry groups', () => {
    const grouped = renderCvHtml(
      {
        ...promoted,
        skills: [
          { id: 's1', name: 'React', group: 'Frontend', source: 'cv' },
          { id: 's2', name: 'Git', source: 'cv' },
        ],
      },
      '',
    );
    expect(grouped).toContain('<strong>Frontend:</strong> React');
    expect(grouped).toContain('<strong>Other:</strong> Git');
  });

  it('drops grades unless the tailored CV asks for them', () => {
    expect(renderCvHtml(applyTailoring(promoted, tailored()), '')).not.toContain('CGPA');
    expect(
      renderCvHtml(applyTailoring(promoted, tailored({ educationDetails: true })), ''),
    ).toContain('CGPA 3.3');
  });
});

describe('checkQuality', () => {
  it('accepts a well-shaped CV', () => {
    expect(checkQuality(tailored(), promoted)).toEqual({ ok: true, problems: [] });
  });

  it('limits the summary to 3 sentences and a sensible length', () => {
    const long = 'One. Two. Three. Four.';
    expect(checkQuality(tailored({ summary: long }), promoted).problems).toEqual([
      'Summary has 4 sentences; keep it to 3',
    ]);
    expect(checkQuality(tailored({ summary: 'x'.repeat(500) }), promoted).problems[0]).toMatch(
      /under 480/,
    );
  });

  it('enforces bullet limits by role position', () => {
    const many = (n: number, cite: string) =>
      Array.from({ length: n }, () => ({ text: 'Did work.', cites: [cite] }));
    const t = tailored({
      experience: [
        { roleId: 'exp-1', bullets: many(6, 'exp-1-b1') },
        { roleId: 'exp-1b', bullets: many(4, 'b-x') },
        { roleId: 'exp-2', bullets: many(3, 'exp-2-b1') },
      ],
    });
    expect(checkQuality(t, promoted).problems).toEqual([
      'Senior Accountant has 6 bullets; the limit for this role is 5',
      'Accountant has 4 bullets; the limit for this role is 3',
      'Accounting Intern has 3 bullets; the limit for this role is 2',
    ]);
  });

  it('caps percentages per bullet and per CV', () => {
    const t = tailored({
      experience: [
        { roleId: 'exp-1', bullets: [{ text: 'Cut cost 20% and time 30%.', cites: ['exp-1-b1'] }] },
      ],
      summary: 'Up 10%, 20%, 30%, 40%. Fine.',
    });
    expect(checkQuality(t, promoted).problems).toEqual([
      '"Cut cost 20% and time 30%." has more than one percentage; keep the strongest',
      '6 percentages in the CV; keep at most 5 you can explain',
    ]);
  });

  it('wants 8–25 skills, or all of a small profile’s skills', () => {
    expect(
      checkQuality(tailored({ skills: [{ text: 'QuickBooks', cites: ['skill-1'] }] }), promoted)
        .problems,
    ).toEqual(["1 skills; use 3–25, the job's required ones first"]);
  });
});

describe('page target', () => {
  it('counts professional years only, then 1 page up to 3 years', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    expect(professionalYears(promoted, now)).toBe(3); // the 2021 internship doesn't count
    expect(professionalYears({ ...promoted, experience: [] }, now)).toBe(0);
    expect(pageTarget(3)).toBe(1);
    expect(pageTarget(4)).toBe(2);
  });
});
