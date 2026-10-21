// schema.org JobPosting data embedded in job pages (the format Google Jobs asks sites
// for). One reader covers every site that publishes it, including sites users add.
import type { RawJob } from '../pipeline/job.ts';
import { htmlToText } from './html.ts';

export type JobPostingFields = Partial<Omit<RawJob, 'source' | 'sourceId'>> & { id?: string };

type Json = Record<string, unknown>;

export function jobPostingFromHtml(html: string): JobPostingFields | undefined {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const posting = findPosting(safeParse(match[1] ?? ''));
    if (posting !== undefined) return toFields(posting);
  }
  return undefined;
}

function toFields(posting: Json): JobPostingFields {
  const fields: JobPostingFields = {};
  const set = <K extends keyof JobPostingFields>(
    key: K,
    value: JobPostingFields[K] | undefined,
  ): void => {
    if (value !== undefined && value !== '') fields[key] = value;
  };
  set('title', text(posting.title));
  set('company', text(asObject(posting.hiringOrganization)?.name));
  set('location', locationText(posting));
  set(
    'description',
    typeof posting.description === 'string' ? htmlToText(posting.description) : undefined,
  );
  set('salaryText', salaryText(asObject(posting.baseSalary)));
  set('postedAt', text(posting.datePosted));
  set('url', text(posting.url));
  set('id', text(asObject(posting.identifier)?.value) ?? text(posting.identifier));
  if (text(posting.jobLocationType)?.toUpperCase() === 'TELECOMMUTE') fields.remoteFlag = true;
  return fields;
}

function locationText(posting: Json): string | undefined {
  const places = toList(posting.jobLocation).map((place) => {
    const address = asObject(asObject(place)?.address);
    return [address?.addressLocality, address?.addressRegion, address?.addressCountry]
      .map(text)
      .filter((part): part is string => part !== undefined)
      .join(', ');
  });
  const applicants = toList(posting.applicantLocationRequirements)
    .map((entry) => text(asObject(entry)?.name) ?? text(entry))
    .filter((name): name is string => name !== undefined);
  if (text(posting.jobLocationType)?.toUpperCase() === 'TELECOMMUTE') places.push('Remote');
  if (applicants.length > 0) places.push(`applicants in: ${applicants.join(', ')}`);
  const joined = places.filter(Boolean).join('; ');
  return joined === '' ? undefined : joined;
}

// Rebuilt as text ("PKR 20000 - 35000 per month") so the one salary parser handles it.
function salaryText(salary: Json | undefined): string | undefined {
  const currency = text(salary?.currency);
  const amount = salaryAmount(salary);
  if (currency === undefined || amount === undefined) return undefined;
  const unit = text(asObject(salary?.value)?.unitText)?.toLowerCase();
  return unit === undefined ? `${currency} ${amount}` : `${currency} ${amount} per ${unit}`;
}

// "20000" or "20000 - 35000", from {value: n} or {value: {minValue, maxValue}}.
function salaryAmount(salary: Json | undefined): string | undefined {
  const value = asObject(salary?.value);
  const min = numberText(value?.minValue ?? value?.value ?? salary?.value);
  if (min === undefined) return undefined;
  const max = numberText(value?.maxValue);
  return max === undefined || max === min ? min : `${min} - ${max}`;
}

function findPosting(data: unknown): Json | undefined {
  for (const node of toList(data)) {
    const object = asObject(node);
    if (object === undefined) continue;
    if (toList(object['@type']).includes('JobPosting')) return object;
    const nested = findPosting(object['@graph']);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function toList(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asObject(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function numberText(value: unknown): string | undefined {
  return typeof value === 'number' || (typeof value === 'string' && /^\d/.test(value))
    ? String(value)
    : undefined;
}
