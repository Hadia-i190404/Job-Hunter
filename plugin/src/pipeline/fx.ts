// Currency conversion for comparing salaries (spec R2). There's no paid rates API
// (spec D4), so these are approximate rates with a date. P1 refreshes them from a free
// source during the daily run. Values are units of the currency per 1 USD.

export const CURRENCIES = [
  'PKR',
  'USD',
  'AED',
  'SAR',
  'QAR',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface FxRates {
  asOf: string;
  perUsd: Record<Currency, number>;
}

export const DEFAULT_RATES: FxRates = {
  asOf: '2026-10-21',
  perUsd: {
    PKR: 281,
    USD: 1,
    AED: 3.6725, // pegged
    SAR: 3.75, // pegged
    QAR: 3.64, // pegged
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.38,
    AUD: 1.52,
    INR: 84,
  },
};

export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rates = DEFAULT_RATES,
): number {
  return (amount / rates.perUsd[from]) * rates.perUsd[to];
}
