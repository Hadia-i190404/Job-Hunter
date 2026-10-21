// Scam and low-quality signals (spec R3). Each signal has a weight: a score of 3 or more
// is "scam" (hidden by default), 2 is "suspicious" (shown with a warning). Real employers
// never charge applicants, so a fee request alone is enough. A single weak signal, like
// a WhatsApp number, is normal in Pakistan and doesn't count on its own.
import type { Job } from './job.ts';

type ScamLevel = 'ok' | 'suspicious' | 'scam';

export interface ScamCheck {
  level: ScamLevel;
  reasons: string[];
}

interface Signal {
  weight: number;
  reason: string;
  pattern: RegExp;
}

const SIGNALS: readonly Signal[] = [
  {
    weight: 3,
    reason: 'Asks you to pay a fee',
    pattern:
      /(?<!\bno |\bwithout |\bzero )\b(?:registration|processing|training|security|visa|medical|application|joining|enrol?lment|admission|form|kit|verification)\s*(?:fee|fees|charges?|deposit)\b|\brefundable (?:fee|deposit|amount)\b|\bpay (?:only )?(?:rs\.?|pkr|\$|usd)\s*[\d,]+/i,
  },
  {
    weight: 2,
    reason: 'Earn-from-home pitch (typing, ad posting, copy-paste, online earning)',
    pattern:
      /\b(?:typing|ad posting|copy[-\s]paste|captcha (?:entry|typing)|online earning|earn (?:money )?(?:online|from home)|daily (?:earning|income)|earn up to)\b/i,
  },
  {
    weight: 3,
    reason: 'Investment, crypto or recruit-others scheme',
    pattern:
      /\b(?:invest(?:ment)? (?:of|required)|crypto(?:currency)? (?:trading|investment)|forex trading|mlm|network marketing|refer (?:\d+ )?(?:friends|people) (?:and|to) earn|binary option)/i,
  },
  {
    weight: 1,
    reason: 'Contact only by WhatsApp',
    pattern: /\bwhats\s?app\b|\bwa\.me\//i,
  },
  {
    weight: 1,
    reason: 'Applications go to a personal email address',
    pattern: /\b[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|live)\.com\b/i,
  },
  {
    weight: 1,
    reason: 'Pressure to act fast',
    pattern:
      /\b(?:limited seats|seats? (?:are )?limited|hurry|apply (?:now|today) before|only today|last chance)\b/i,
  },
  {
    weight: 1,
    reason: 'No experience or qualifications needed for high pay',
    pattern: /\bno (?:experience|qualification|degree|interview)s? (?:required|needed)\b/i,
  },
];

type ScamFacts = Pick<Job, 'title' | 'company' | 'description'> & Partial<Pick<Job, 'salary'>>;

// A month's pay this high with "no experience" is a classic bait (PKR 300k ≈ senior pay).
const BAIT_PKR_PER_MONTH = 300_000;

export function checkScam(job: ScamFacts): ScamCheck {
  const text = `${job.title}\n${job.description}`;
  const hits = SIGNALS.filter((signal) => signal.pattern.test(text));
  const reasons = hits.map((hit) => hit.reason);
  let score = hits.reduce((sum, hit) => sum + hit.weight, 0);

  if (job.company.trim() === '' || /^(?:confidential|private|n\/?a)$/i.test(job.company.trim())) {
    score += 1;
    reasons.push('No company name');
  }
  const noExperience = hits.some((hit) => hit.reason.startsWith('No experience'));
  if (noExperience && (job.salary?.pkrPerMonth.max ?? 0) >= BAIT_PKR_PER_MONTH) {
    score += 2;
    reasons.push('Very high pay for a no-experience job');
  }
  if (score >= 3) return { level: 'scam', reasons };
  return score === 2 ? { level: 'suspicious', reasons } : { level: 'ok', reasons: [] };
}
