// Prepare one application (S1.6): answer each form question from the profile and the
// answer bank; everything else goes on the user's to-do list (D20). Forms that forbid
// AI-written content get facts only (D19).
import type { AnswersFile } from '../schema/loop.ts';
import type { Profile } from '../schema/profile.ts';
import type { FormQuestion } from './questions.ts';

interface PreparedAnswer {
  question: string;
  answer?: string;
  from: 'profile' | 'answers' | 'user' | 'claude' | 'todo';
}

export interface Prepared {
  answers: PreparedAnswer[];
  todo: string[];
  noAi: boolean;
}

// "I agree to use only my own words … the use of AI … will disqualify my application."
const NO_AI =
  /\b(?:only my own words|in my own words|use of (?:ai|artificial intelligence)|ai[-\s]generated|generated content|without (?:the )?(?:use of )?ai)\b/i;
// Declarations, consents and policies: a promise from the user, so always theirs to tick.
const DECLARATION =
  /\b(?:i agree|i confirm|i acknowledge|i certify|acknowledge\/confirm|privacy (?:notice|policy)|consent|declaration|terms)\b/i;
const DEMOGRAPHIC =
  /\b(?:gender|race|ethnic|veteran|disability|sexual orientation|pronoun|nationality)\b/i;

type Bank = AnswersFile['answers'];

export function prepareAnswers(
  questions: readonly FormQuestion[],
  profile: Profile,
  bank: Bank,
  cvPath: string,
): Prepared {
  const noAi = questions.some((q) => NO_AI.test(q.label));
  const todo: string[] = [];
  const answers = questions.map((q) => {
    const answer = answerFor(q, profile, bank, cvPath);
    if (answer !== undefined) return answer;
    if (q.required || DECLARATION.test(q.label)) todo.push(todoFor(q, noAi));
    return { question: q.label, from: 'todo' as const };
  });
  return { answers, todo, noAi };
}

function answerFor(
  q: FormQuestion,
  profile: Profile,
  bank: Bank,
  cvPath: string,
): PreparedAnswer | undefined {
  if (DECLARATION.test(q.label)) return undefined;
  const fromProfile = profileAnswer(q, profile, cvPath);
  if (fromProfile !== undefined) return { question: q.label, answer: fromProfile, from: 'profile' };
  const banked = bankAnswer(q, bank);
  if (banked !== undefined) return { question: q.label, answer: banked, from: 'answers' };
  return undefined;
}

// Form fields the profile answers directly, by label.
type Getter = (profile: Profile, cvPath: string) => string | undefined;
const link = (profile: Profile, pattern: RegExp): string | undefined =>
  profile.contact.links.find((l) => pattern.test(l));
const nameParts = (profile: Profile): string[] => profile.name.trim().split(/\s+/);
const PROFILE_FIELDS: readonly (readonly [RegExp, Getter])[] = [
  [/^first name/, (p) => nameParts(p)[0]],
  [/^last name/, (p) => nameParts(p).slice(1).join(' ') || undefined],
  [/^(full )?name$/, (p) => p.name],
  [/^e-?mail/, (p) => p.contact.email],
  [/^phone/, (p) => p.contact.phone],
  [/linkedin/, (p) => link(p, /linkedin\.com/i)],
  [/github/, (p) => link(p, /github\.com/i)],
  [/^(location|city)\b/, (p) => p.contact.city],
];

function profileAnswer(q: FormQuestion, profile: Profile, cvPath: string): string | undefined {
  const label = q.label.toLowerCase();
  if (q.type === 'file' && /resume|cv/.test(label)) return cvPath;
  return PROFILE_FIELDS.find(([pattern]) => pattern.test(label))?.[1](profile, cvPath);
}

// Answer-bank entries match by their saved question or key words; options must match
// exactly, since a select can only take one of its listed values.
function bankAnswer(q: FormQuestion, bank: Bank): string | undefined {
  const label = normalise(q.label);
  const entry = bank.find((a) => normalise(a.question) === label) ?? keyedEntry(q.label, bank);
  if (entry === undefined) return undefined;
  if (DEMOGRAPHIC.test(q.label) && entry.kind !== 'demographic') return undefined;
  if (q.options.length === 0) return entry.answer;
  return q.options.find((option) => normalise(option) === normalise(entry.answer));
}

const KEYS: readonly (readonly [RegExp, string])[] = [
  [/notice period/i, 'notice-period'],
  [/(earliest )?start date|when can you start/i, 'earliest-start'],
  [/(expected|desired) (salary|compensation)/i, 'expected-salary-usd-month'],
  [/country.*(work|live|reside|located)|(work|live|reside|located).*country/i, 'current-country'],
  [/sponsor/i, 'needs-sponsorship'],
  [/authori[sz]ed to work|work authori[sz]ation|right to work/i, 'work-authorization'],
  [/relocat/i, 'open-to-relocation'],
  [/travel/i, 'willing-to-travel-internationally'],
  [/how did you (hear|find)/i, 'how-did-you-hear'],
  [/degree result|grade|gpa/i, 'degree-result'],
  [/grading system/i, 'grading-system'],
  [/how many companies/i, 'companies-since-graduation'],
  [/mathematics|math/i, 'hs-math-rank'],
  [/native language/i, 'hs-language-rank'],
  [/website|portfolio/i, 'portfolio-url'],
  [/gender/i, 'gender'],
  [/nationality/i, 'nationality'],
  [/race|ethnic/i, 'ethnicity'],
  [/disability/i, 'disability'],
];

function keyedEntry(label: string, bank: Bank): Bank[number] | undefined {
  let key = KEYS.find(([pattern]) => pattern.test(label))?.[1];
  // Rupee questions take the PKR expectation; everything else the USD one.
  if (key === 'expected-salary-usd-month' && /\b(pkr|rs|rupees?)\b/i.test(label))
    key = 'expected-salary-pkr-month';
  return key === undefined ? undefined : bank.find((a) => a.key === key);
}

function todoFor(q: FormQuestion, noAi: boolean): string {
  if (DECLARATION.test(q.label)) return `Tick yourself: "${clip(q.label)}"`;
  if (q.type === 'textarea')
    return noAi ? `Write in your own words: "${clip(q.label)}"` : `Answer: "${clip(q.label)}"`;
  return `Answer: "${clip(q.label)}"${q.options.length > 0 ? ` (choose: ${q.options.slice(0, 4).join(' / ')}${q.options.length > 4 ? ' …' : ''})` : ''}`;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function clip(text: string): string {
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}
