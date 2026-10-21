// Salary text → numbers, normalised to PKR and USD per month (spec R2). Missing or vague
// pay ("Competitive", "Negotiable") is "not stated": undefined, never a guess.
import { convert, DEFAULT_RATES, type Currency, type FxRates } from './fx.ts';

type Period = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface Salary {
  min: number;
  max: number;
  currency: Currency;
  period: Period;
  // True when the text gave no period and it was read from the size of the amount.
  periodInferred: boolean;
  pkrPerMonth: { min: number; max: number };
  usdPerMonth: { min: number; max: number };
}

// Order matters: specific symbols before the bare "$".
const CURRENCY_PATTERNS: readonly (readonly [Currency, RegExp])[] = [
  ['PKR', /\bpkr\b|\brs\.?|₨|\brupees?\b/i],
  ['INR', /\binr\b|₹/i],
  ['AED', /\baed\b|\bdhs?\b|\bdirhams?\b/i],
  ['SAR', /\bsar\b|\briyals?\b|\bsr\b/i],
  ['QAR', /\bqar\b/i],
  ['CAD', /\bcad\b|c\$/i],
  ['AUD', /\baud\b|a\$/i],
  ['EUR', /\beur\b|€/i],
  ['GBP', /\bgbp\b|£/i],
  ['USD', /\busd\b|us\$|\$/i],
];

const PERIOD_PATTERNS: readonly (readonly [Period, RegExp])[] = [
  ['hour', /\b(?:per |an |a |\/\s*)?(?:hour|hr|hrs)\b|\/\s*h\b|\bhourly\b/i],
  ['day', /\b(?:per |a |\/\s*)?day\b|\bdaily\b/i],
  ['week', /\b(?:per |a |\/\s*)?(?:week|wk)\b|\bweekly\b/i],
  ['month', /\b(?:per |a |\/\s*)?(?:month|mo|mth)\b|\bmonthly\b|\bp\.?m\.?\b/i],
  ['year', /\b(?:per |a |\/\s*)?(?:year|yr|annum)\b|\bannual(?:ly)?\b|\bp\.?a\.?\b|\byearly\b/i],
];

// Hours per month for a full-time week: 40 h × 52 weeks / 12 months.
const PER_MONTH: Record<Period, number> = {
  hour: (40 * 52) / 12,
  day: (5 * 52) / 12,
  week: 52 / 12,
  month: 1,
  year: 1 / 12,
};

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  crore: 1e7,
};

// "150k", "1,50,000", "1.5 lac", "80,000.00"
const AMOUNT = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mn|m|million|lacs?|lakhs?|crore)?\b/gi;

export function parseSalary(
  text: string | undefined,
  rates: FxRates = DEFAULT_RATES,
): Salary | undefined {
  if (text === undefined) return undefined;
  const amounts = readAmounts(text);
  const currency = detectCurrency(text);
  if (amounts.length === 0 || currency === undefined) return undefined;

  const min = Math.min(...amounts.slice(0, 2));
  const max = Math.max(...amounts.slice(0, 2));
  const stated = detectPeriod(text);
  const period = stated ?? inferPeriod(max, currency, rates);
  if (period === undefined) return undefined;

  const monthly = (value: number, to: Currency): number =>
    Math.round(convert(value * PER_MONTH[period], currency, to, rates));
  return {
    min,
    max,
    currency,
    period,
    periodInferred: stated === undefined,
    pkrPerMonth: { min: monthly(min, 'PKR'), max: monthly(max, 'PKR') },
    usdPerMonth: { min: monthly(min, 'USD'), max: monthly(max, 'USD') },
  };
}

function readAmounts(text: string): number[] {
  const values = [...text.matchAll(AMOUNT)].map((match) => ({
    value: Number((match[1] ?? '').replace(/,/g, '')),
    unit: match[2]?.toLowerCase(),
  }));
  // A range shares its unit ("150-200k" is 150k to 200k), but only for short numbers:
  // in "80,000 - 1 lac" the 80,000 is already complete.
  const sharedUnit = values.findLast((entry) => entry.unit !== undefined)?.unit;
  return values
    .map(
      ({ value, unit }) =>
        value * (MULTIPLIERS[unit ?? (value < 1000 ? sharedUnit : '') ?? ''] ?? 1),
    )
    .filter((value) => Number.isFinite(value) && value >= 1);
}

// Lakh and crore are how Pakistani posts write rupee amounts, even with no "Rs".
const SOUTH_ASIAN_UNITS = /\b(?:lacs?|lakhs?|crores?)\b/i;

function detectCurrency(text: string): Currency | undefined {
  const named = CURRENCY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
  return named ?? (SOUTH_ASIAN_UNITS.test(text) ? 'PKR' : undefined);
}

function detectPeriod(text: string): Period | undefined {
  return PERIOD_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

// With no stated period, decide from the size of the pay. Pakistani posts quote monthly
// pay in rupees, often well under 250 USD, so rupees get their own bands. Elsewhere,
// tiny is hourly, mid is monthly, large is yearly. Ambiguous sizes give up.
function inferPeriod(max: number, currency: Currency, rates: FxRates): Period | undefined {
  if (currency === 'PKR') {
    if (max >= 10_000 && max <= 1_500_000) return 'month';
    return max >= 1_800_000 ? 'year' : undefined;
  }
  const usd = convert(max, currency, 'USD', rates);
  if (usd < 200) return 'hour';
  if (usd >= 250 && usd <= 15_000) return 'month';
  if (usd >= 20_000) return 'year';
  return undefined;
}
