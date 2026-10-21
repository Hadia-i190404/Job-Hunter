import { describe, expect, it } from 'vitest';
import { convert } from '../../plugin/src/pipeline/fx.ts';
import { parseSalary } from '../../plugin/src/pipeline/salary.ts';

const pick = (text: string): unknown => {
  const s = parseSalary(text);
  return s && { min: s.min, max: s.max, currency: s.currency, period: s.period };
};

describe('parseSalary: real posting strings', () => {
  it.each([
    ['Rs. 150k–200k/month', 150_000, 200_000, 'PKR', 'month'],
    ['PKR 150,000 - 200,000', 150_000, 200_000, 'PKR', 'month'],
    ['150K-200K PKR', 150_000, 200_000, 'PKR', 'month'],
    ['Rs 80,000 - 1 Lac', 80_000, 100_000, 'PKR', 'month'],
    ['1 - 1.5 lakh per month', 100_000, 150_000, 'PKR', 'month'],
    ['Rs. 45,000', 45_000, 45_000, 'PKR', 'month'],
    ['PKR 3.6M per annum', 3_600_000, 3_600_000, 'PKR', 'year'],
    ['Rs 2,400,000', 2_400_000, 2_400_000, 'PKR', 'year'],
    ['$40/hr', 40, 40, 'USD', 'hour'],
    ['$25 - $35 an hour', 25, 35, 'USD', 'hour'],
    ['$80,000 - $100,000 a year', 80_000, 100_000, 'USD', 'year'],
    ['USD 3000/month', 3000, 3000, 'USD', 'month'],
    ['US$1,500 - 2,500 monthly', 1500, 2500, 'USD', 'month'],
    ['$120k', 120_000, 120_000, 'USD', 'year'],
    ['AED 15,000 per month', 15_000, 15_000, 'AED', 'month'],
    ['SAR 12,000 - 18,000', 12_000, 18_000, 'SAR', 'month'],
    ['€50k - €65k', 50_000, 65_000, 'EUR', 'year'],
    ['£40,000 pa', 40_000, 40_000, 'GBP', 'year'],
    ['CAD 95,000/yr', 95_000, 95_000, 'CAD', 'year'],
    ['$500 per week', 500, 500, 'USD', 'week'],
  ])('%s', (text, min, max, currency, period) => {
    expect(pick(text)).toEqual({ min, max, currency, period });
  });

  it.each(['Competitive', 'Negotiable', 'Market competitive salary', '', 'Up to 50 people team'])(
    'treats "%s" as not stated',
    (text) => {
      expect(parseSalary(text)).toBeUndefined();
    },
  );

  it('is undefined when there is no salary text', () => {
    expect(parseSalary(undefined)).toBeUndefined();
  });

  it('gives up on an amount whose period cannot be told', () => {
    expect(parseSalary('$17,000')).toBeUndefined(); // a month in the US? a year in Asia?
    expect(parseSalary('Rs 5,000')).toBeUndefined();
  });
});

describe('parseSalary: normalisation', () => {
  it('converts to PKR and USD per month', () => {
    const s = parseSalary('$40/hr');
    expect(s?.usdPerMonth.min).toBe(Math.round((40 * 40 * 52) / 12));
    expect(s?.pkrPerMonth.min).toBe(Math.round(convert((40 * 40 * 52) / 12, 'USD', 'PKR')));
  });

  it('marks an inferred period', () => {
    expect(parseSalary('PKR 150,000')?.periodInferred).toBe(true);
    expect(parseSalary('PKR 150,000 per month')?.periodInferred).toBe(false);
  });

  it('keeps pegged Gulf currencies stable', () => {
    expect(convert(3.6725, 'AED', 'USD')).toBeCloseTo(1);
    expect(convert(3.75, 'SAR', 'USD')).toBeCloseTo(1);
  });
});
