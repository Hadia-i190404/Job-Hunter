// RawJob (whatever the site gave) → Job (one shape for everything downstream).
import { DEFAULT_RATES, type FxRates } from './fx.ts';
import type { Job, RawJob } from './job.ts';
import { matchPlace } from './location.ts';
import { parseSalary } from './salary.ts';
import { cleanCompany, cleanTitle, companyKey } from './text.ts';
import { detectWorkMode } from './work-mode.ts';

export function normalizeJob(raw: RawJob, now = new Date(), rates: FxRates = DEFAULT_RATES): Job {
  const locationText = (raw.location ?? '').replace(/\s+/g, ' ').trim();
  const description = (raw.description ?? '').trim();
  const place = matchPlace(locationText);
  const seen = now.toISOString();
  const job: Job = {
    id: `${raw.source}:${raw.sourceId}`,
    source: raw.source,
    sourceId: raw.sourceId,
    url: raw.url,
    title: cleanTitle(raw.title) || raw.title.trim(),
    company: cleanCompany(raw.company),
    companyKey: companyKey(raw.company),
    locationText,
    cities: place.cities,
    inPakistan: place.inPakistan,
    workMode: detectWorkMode({
      location: locationText,
      title: raw.title,
      description,
      ...(raw.remoteFlag === undefined ? {} : { remoteFlag: raw.remoteFlag }),
    }),
    description,
    firstSeenAt: seen,
    lastSeenAt: seen,
  };
  const salary = parseSalary(raw.salaryText, rates);
  if (salary !== undefined) job.salary = salary;
  if (raw.salaryText !== undefined && raw.salaryText.trim() !== '')
    job.salaryText = raw.salaryText.trim();
  const posted = toIso(raw.postedAt);
  if (posted !== undefined) job.postedAt = posted;
  return job;
}

function toIso(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}
