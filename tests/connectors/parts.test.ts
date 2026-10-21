import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText } from '../../plugin/src/connectors/html.ts';
import { createHttpClient, type FetchLike } from '../../plugin/src/connectors/http.ts';
import { jobPostingFromHtml } from '../../plugin/src/connectors/jsonld.ts';
import { titleMatches } from '../../plugin/src/connectors/keywords.ts';
import { parseRssItems } from '../../plugin/src/connectors/rss.ts';

const ld = (data: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('html', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('a &amp; b &#x2B; &#39;c&#39; &rsquo; &bogus; &#0;')).toBe(
      "a & b + 'c' ’ &bogus; &#0;",
    );
  });

  it('turns markup into readable text', () => {
    expect(htmlToText('<p>One</p><ul><li>a</li><li>b</li></ul><script>x()</script>Two<br>3')).toBe(
      'One\n• a\n• b\nTwo\n3',
    );
  });
});

describe('titleMatches', () => {
  it.each([
    ['Senior React Developer (Remote)', ['react developer'], true],
    ['React Native Lead', ['react developer'], false],
    ['Sr. Accountant', ['accountant'], true],
    ['C# .NET Developer', ['c# developer'], true],
    ['Anything', [], true],
    ['Anything', [''], false],
  ])('%s vs %j → %s', (title, keywords, expected) => {
    expect(titleMatches(title, keywords)).toBe(expected);
  });
});

describe('rss', () => {
  it('reads plain and CDATA fields', () => {
    const items = parseRssItems(
      '<rss><item><title>A &amp; B</title><x:y><![CDATA[<b>z</b>]]></x:y></item></rss>',
    );
    expect(items).toEqual([{ title: 'A & B', 'x:y': '<b>z</b>' }]);
  });
});

describe('jobPostingFromHtml', () => {
  it('finds a posting inside @graph and reads remote + applicant rules', () => {
    const html = ld({
      '@graph': [
        { '@type': 'WebPage' },
        {
          '@type': ['JobPosting'],
          title: 'Engineer',
          identifier: 'E-1',
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: [{ '@type': 'Country', name: 'Pakistan' }, 'India'],
          baseSalary: { currency: 'USD', value: { value: 4000, unitText: 'MONTH' } },
        },
      ],
    });
    expect(jobPostingFromHtml(html)).toEqual({
      title: 'Engineer',
      id: 'E-1',
      remoteFlag: true,
      location: 'Remote; applicants in: Pakistan, India',
      salaryText: 'USD 4000 per month',
    });
  });

  it('handles salary without a unit, and odd shapes', () => {
    const html = ld({
      '@type': 'JobPosting',
      title: 'X',
      baseSalary: { currency: 'PKR', value: 90000 },
    });
    expect(jobPostingFromHtml(html)?.salaryText).toBe('PKR 90000');
    expect(
      jobPostingFromHtml(ld({ '@type': 'JobPosting', baseSalary: { value: 1 } }))?.salaryText,
    ).toBe(undefined);
  });

  it('returns undefined without a posting or with broken JSON', () => {
    expect(jobPostingFromHtml('<p>nothing</p>')).toBeUndefined();
    expect(jobPostingFromHtml('<script type="application/ld+json">{oops</script>')).toBeUndefined();
    expect(jobPostingFromHtml(ld([null, 'x', { '@type': 'Thing' }]))).toBeUndefined();
  });
});

describe('createHttpClient', () => {
  const respond =
    (status: number, body: string): FetchLike =>
    () =>
      Promise.resolve(new Response(body, { status }));
  const noSleep = { sleep: () => Promise.resolve() };

  it.each([
    [200, 'fine', 'ok'],
    [403, '<title>Just a moment...</title>', 'blocked'],
    [200, '<html><title>Just a moment...</title></html>', 'blocked'],
    [429, 'slow down', 'blocked'],
    [404, 'gone', 'not-found'],
    [410, 'gone', 'not-found'],
    [500, 'oops', 'error'],
    [403, 'forbidden', 'error'],
  ])('HTTP %i %s → %s', async (status, body, expected) => {
    const http = createHttpClient({ fetch: respond(status, body), ...noSleep });
    expect((await http.get('https://example.com/')).status).toBe(expected);
  });

  it('reports network failures', async () => {
    const http = createHttpClient({
      fetch: () => Promise.reject(new Error('offline')),
      ...noSleep,
    });
    expect(await http.get('https://example.com/')).toEqual({ status: 'error', message: 'offline' });
  });

  it('sends one request at a time per host, with a pause, and identifies itself', async () => {
    const events: string[] = [];
    let active = 0;
    const fetch: FetchLike = async (url, init) => {
      active += 1;
      events.push(`start ${url} active=${String(active)}`);
      expect(new Headers(init?.headers).get('user-agent')).toContain('JobHunter');
      await Promise.resolve();
      active -= 1;
      return new Response('ok');
    };
    const sleep = (ms: number): Promise<void> => {
      events.push(`pause ${String(ms)}`);
      return Promise.resolve();
    };
    const http = createHttpClient({ fetch, sleep, minDelayMs: 10 });
    await Promise.all([http.get('https://a.example/1'), http.get('https://a.example/2')]);
    expect(events).toEqual([
      'start https://a.example/1 active=1',
      'pause 10',
      'start https://a.example/2 active=1',
      'pause 10',
    ]);
  });
});
