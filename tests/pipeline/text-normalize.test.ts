import { describe, expect, it } from 'vitest';
import { jobSchema } from '../../plugin/src/pipeline/job.ts';
import { normalizeJob } from '../../plugin/src/pipeline/normalize.ts';
import { cleanCompany, cleanTitle, companyKey } from '../../plugin/src/pipeline/text.ts';

describe('cleanTitle', () => {
  it.each([
    ['URGENT HIRING: Senior React Developer', 'Senior React Developer'],
    ['🚀 Backend Engineer (Remote)', 'Backend Engineer'],
    ["We're hiring - Product Designer", 'Product Designer'],
    ['Software Engineer (m/f/d)', 'Software Engineer'],
    ['Data Analyst - Remote', 'Data Analyst'],
    ['Accountant [Full-time] Job ID: 4521', 'Accountant'],
    ['Customer Support Officer (WFH)', 'Customer Support Officer'],
    ['Sr.   Flutter    Developer', 'Sr. Flutter Developer'],
  ])('%s → %s', (raw, clean) => {
    expect(cleanTitle(raw)).toBe(clean);
  });
});

describe('company names', () => {
  it.each([
    ['Systems Ltd.', 'systems'],
    ['SYSTEMS LIMITED', 'systems'],
    ['Arbisoft (Pvt.) Ltd', 'arbisoft'],
    ['10Pearls Pvt Ltd', '10pearls'],
    ['Careem Networks FZ-LLC', 'careem networks'],
    ['Acme, Inc.', 'acme'],
    ['Daraz.pk', 'daraz pk'],
    ['Jazz & Co.', 'jazz and'],
    ['Zameen.com SMC-Private Limited', 'zameen com'],
  ])('%s → %s', (raw, key) => {
    expect(companyKey(raw)).toBe(key);
  });

  it('keeps the display name readable', () => {
    expect(cleanCompany('  Systems   Ltd. ')).toBe('Systems Ltd.');
  });
});

describe('normalizeJob', () => {
  const now = new Date('2026-10-21T04:00:00.000Z');

  it('produces a valid job record', () => {
    const job = normalizeJob(
      {
        source: 'rozee',
        sourceId: '123',
        url: 'https://www.rozee.pk/job/123',
        title: 'URGENT HIRING: Accountant',
        company: 'Example Traders (Pvt.) Ltd',
        location: '  Lahore   (Hybrid) ',
        salaryText: 'Rs. 80k - 120k / month',
        postedAt: '2026-10-20',
        description: ' Keep the books. ',
      },
      now,
    );
    expect(job).toMatchObject({
      id: 'rozee:123',
      title: 'Accountant',
      companyKey: 'example traders',
      locationText: 'Lahore (Hybrid)',
      cities: ['lahore'],
      inPakistan: true,
      workMode: 'hybrid',
      salary: { min: 80_000, max: 120_000, currency: 'PKR', period: 'month' },
      salaryText: 'Rs. 80k - 120k / month',
      postedAt: '2026-10-20T00:00:00.000Z',
      description: 'Keep the books.',
      firstSeenAt: now.toISOString(),
    });
    expect(jobSchema(job).ok).toBe(true);
  });

  it('handles a bare remote job with no salary or date', () => {
    const job = normalizeJob(
      {
        source: 'remotive',
        sourceId: '9',
        url: 'https://remotive.com/9',
        title: 'Engineer',
        company: 'Acme',
        remoteFlag: true,
        postedAt: 'not a date',
      },
      now,
    );
    expect(job).toMatchObject({ workMode: 'remote', inPakistan: false, cities: [] });
    expect(job.salary).toBeUndefined();
    expect(job.postedAt).toBeUndefined();
    expect(jobSchema(job).ok).toBe(true);
  });

  it('rejects a job without a real link', () => {
    const job = normalizeJob(
      { source: 's', sourceId: '1', url: 'javascript:alert(1)', title: 'X', company: 'Y' },
      now,
    );
    expect(jobSchema(job).ok).toBe(false);
  });
});
