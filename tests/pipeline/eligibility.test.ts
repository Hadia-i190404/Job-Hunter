import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessEligibility } from '../../plugin/src/pipeline/eligibility.ts';
import { findPlaces } from '../../plugin/src/pipeline/places.ts';
import { evaluateLabelled, type LabelledJob } from './eligibility-eval.ts';

const labelled = (
  JSON.parse(
    readFileSync(new URL('../fixtures/labelled/eligibility.json', import.meta.url), 'utf8'),
  ) as { jobs: LabelledJob[] }
).jobs;

const facts = (over: Partial<Parameters<typeof assessEligibility>[0]>) => ({
  locationText: '',
  description: '',
  workMode: 'remote' as const,
  cities: [],
  inPakistan: false,
  ...over,
});

describe('eligibility on the labelled set (rules only)', () => {
  const report = evaluateLabelled(labelled);

  it('meets the spec targets', () => {
    expect(labelled.length).toBeGreaterThanOrEqual(100);
    expect(report.positivePrecision).toBeGreaterThanOrEqual(0.9);
    expect(report.negativeRecall).toBeGreaterThanOrEqual(0.85);
  });

  it('never says yes to a job someone in Pakistan cannot take', () => {
    const wrongYes = report.mismatches.filter(
      (m) => m.expected === 'not-eligible' && (m.got === 'eligible' || m.got === 'likely'),
    );
    expect(wrongYes).toEqual([]);
  });
});

describe('assessEligibility details', () => {
  it('flags US hours as a night shift without rejecting the job', () => {
    const result = assessEligibility(
      facts({ locationText: 'Worldwide', description: 'Overlap with EST hours is required.' }),
    );
    expect(result).toMatchObject({ verdict: 'eligible', nightShift: true });
    expect(result.reasons).toContain('Needs US working hours (a night shift in Pakistan)');
  });

  it('notes contractor and Employer-of-Record hiring', () => {
    const result = assessEligibility(
      facts({ locationText: 'Remote', description: 'We hire through Deel as contractors.' }),
    );
    expect(result.reasons).toContain('Hires contractors or uses an Employer of Record');
    expect(result.needsClaude).toBe(true);
  });

  it('quotes the sentence that rules a job out', () => {
    const result = assessEligibility(
      facts({ locationText: 'Remote', description: 'You must be located in Canada. Thanks.' }),
    );
    expect(result.verdict).toBe('not-eligible');
    expect(result.reasons[0]).toContain('"You must be located in Canada"');
  });

  it('handles local jobs with and without a city', () => {
    expect(
      assessEligibility(facts({ workMode: 'hybrid', cities: ['lahore'], inPakistan: true })),
    ).toMatchObject({
      verdict: 'eligible',
      reasons: ['Hybrid job in lahore'],
    });
    expect(assessEligibility(facts({ workMode: 'onsite', inPakistan: true })).verdict).toBe(
      'likely',
    );
    expect(assessEligibility(facts({ workMode: 'unknown' })).verdict).toBe('unclear');
  });

  it('ignores a company HQ sentence without a country', () => {
    const result = assessEligibility(
      facts({ locationText: 'Remote', description: 'Our candidates love us. Location: flexible.' }),
    );
    expect(result.verdict).toBe('unclear');
  });
});

describe('findPlaces', () => {
  it('trusts short codes only in capitals', () => {
    expect(findPlaces('Join us, contact us').countries).toEqual([]);
    expect(findPlaces('Remote (US)').countries).toEqual(['United States']);
    expect(findPlaces('Columbus, IN').countries).toEqual(['United States']);
    expect(findPlaces('Remote UK, EU').countries).toEqual(['United Kingdom', 'European Union']);
  });

  it('does not match a country inside another word', () => {
    expect(findPlaces('Americas').countries).toEqual([]);
    expect(findPlaces('Indians').countries).toEqual([]);
  });
});
