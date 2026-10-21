import { describe, expect, it } from 'vitest';
import { assessEligibility, type Eligibility } from '../../plugin/src/pipeline/eligibility.ts';
import { bestMatch, matchJob, seniorityOf, titleScore } from '../../plugin/src/pipeline/match.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import type { Search } from '../../plugin/src/schema/loop.ts';

const frontend: Search = {
  id: 'search-1',
  name: 'Frontend, remote',
  titles: ['Frontend Engineer', 'React Developer'],
  seniority: ['mid', 'senior'],
  experienceYears: { min: 2, max: 5 },
  mustSkills: ['React', 'TypeScript'],
  niceSkills: ['Flutter'],
  cities: [],
  workModes: ['remote'],
  employment: ['full-time'],
  salaryFloor: { amount: 1500, currency: 'USD' },
  nightShiftOk: false,
  skipCompanies: ['QLU.ai'],
  mode: 'review',
};
const islamabad: Search = {
  ...frontend,
  id: 'search-2',
  name: 'Full-stack, Islamabad',
  titles: ['Full Stack Engineer'],
  workModes: ['hybrid', 'onsite'],
  cities: ['islamabad', 'rawalpindi'],
};

const job = (over: {
  title?: string;
  location?: string;
  description?: string;
  company?: string;
  salaryText?: string;
}) =>
  normalizeJob({
    source: 's',
    sourceId: '1',
    url: 'https://example.com/1',
    title: 'Web Frontend Engineer',
    company: 'Example',
    location: 'Home based - Worldwide',
    description: 'React, TypeScript and Flutter.',
    ...over,
  });

const verdict = (j: ReturnType<typeof job>): Eligibility => assessEligibility(j);

describe('titleScore', () => {
  it.each([
    ['Web Frontend Engineer - JS, CSS, React, Flutter', 50],
    ['Senior Front-End Developer', 50],
    ['React Developer', 50],
    ['Frontend Lead', 33],
    ['Golang Engineer', 17],
    ['Accountant', 0],
  ])('%s → %i', (title, score) => {
    expect(titleScore(title, frontend.titles)).toBe(score);
  });
});

describe('seniorityOf', () => {
  it.each([
    ['Software Engineer I', 'junior'],
    ['Software Engineer II', 'mid'],
    ['Sr. React Developer', 'senior'],
    ['Staff Engineer', 'lead'],
    ['Graduate Software Engineer', 'junior'],
    ['Frontend Intern', 'intern'],
    ['Frontend Engineer', 'mid'],
  ])('%s → %s', (title, level) => {
    expect(seniorityOf(title)).toBe(level);
  });
});

describe('matchJob', () => {
  it('rates a remote React role as a strong fit, with reasons', () => {
    const j = job({ salaryText: '$2,500 per month' });
    const m = matchJob(j, frontend, verdict(j));
    expect(m).toMatchObject({ fit: 'strong', blockers: [] });
    expect(m.reasons).toEqual([
      'Title matches your role',
      'Mentions React, TypeScript, Flutter',
      'Pay meets your minimum',
    ]);
  });

  it('blocks roles outside Pakistan, the wrong mode or city, skipped companies and US hours', () => {
    const usOnly = job({ location: 'Remote, United States' });
    expect(matchJob(usOnly, frontend, verdict(usOnly)).blockers[0]).toMatch(
      /only from United States/,
    );
    const lahore = job({ location: 'Lahore (Hybrid)', title: 'Full Stack Engineer' });
    expect(matchJob(lahore, islamabad, verdict(lahore)).blockers).toEqual([
      'In lahore (you chose islamabad, rawalpindi)',
    ]);
    expect(matchJob(lahore, frontend, verdict(lahore)).blockers).toContain(
      'hybrid (you want remote)',
    );
    const own = job({ company: 'QLU.ai' });
    expect(matchJob(own, frontend, verdict(own)).blockers).toContain('A company you asked to skip');
    const night = job({ description: 'React and TypeScript. Must work EST hours.' });
    expect(matchJob(night, frontend, verdict(night)).blockers).toContain(
      'Needs US hours, and you said no night shifts',
    );
    const other = job({ title: 'Accountant' });
    expect(matchJob(other, frontend, verdict(other)).fit).toBe('no');
  });

  it('ranks low pay and off-level roles lower without hiding them', () => {
    const low = job({
      title: 'Frontend Lead',
      salaryText: '$800 per month',
      description: 'React only.',
    });
    const m = matchJob(low, frontend, verdict(low));
    expect(m.blockers).toEqual([]);
    expect(m.fit).toBe('stretch');
    expect(m.reasons).toContain('Looks lead-level (you chose mid/senior)');
    expect(m.reasons).toContain('Pay is below your minimum (USD 800/month)');
  });

  it('notes when eligibility needs a closer look', () => {
    const j = job({ location: 'Remote' });
    expect(matchJob(j, frontend, verdict(j)).reasons).toContain(
      'Whether Pakistan can apply needs a closer look',
    );
  });

  it('handles searches with no seniority, skills or floor', () => {
    const open: Search = { ...frontend, seniority: [], mustSkills: [], niceSkills: [] };
    delete open.salaryFloor;
    const j = job({});
    expect(matchJob(j, open, verdict(j)).score).toBe(90); // 50 title + 15 level + 20 skills + 5 unknown pay
  });
});

describe('bestMatch', () => {
  it('picks the search the job fits best, preferring a non-blocked fit', () => {
    const hybrid = job({
      location: 'Islamabad (Hybrid)',
      title: 'Full Stack Engineer',
      description: 'React, TypeScript',
    });
    expect(bestMatch(hybrid, [frontend, islamabad], verdict(hybrid))?.searchId).toBe('search-2');
    expect(bestMatch(hybrid, [], verdict(hybrid))).toBeUndefined();
  });
});
