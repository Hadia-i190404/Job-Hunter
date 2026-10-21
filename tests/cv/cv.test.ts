import { readFileSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findChrome, printToPdf } from '../../plugin/src/cv/chrome.ts';
import { docxText } from '../../plugin/src/cv/docx-text.ts';
import { formatMonth, renderCvHtml } from '../../plugin/src/cv/render.ts';
import type { Profile } from '../../plugin/src/schema/profile.ts';
import { checkProfile, loadProfile, saveProfile } from '../../plugin/src/store/profile.ts';
import { useTempDir } from '../store/helpers.ts';
import { makeZip } from './zip.ts';

const tempDir = useTempDir();
const fake = JSON.parse(
  readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
) as unknown;
const profile = (): Profile => {
  const checked = checkProfile(structuredClone(fake));
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  return checked.profile;
};

describe('checkProfile', () => {
  it('accepts the fake profile', () => {
    expect(checkProfile(fake).ok).toBe(true);
  });

  it('reports bad dates and duplicate ids', () => {
    const bad = structuredClone(fake) as { experience: { start: string; id: string }[] };
    bad.experience[0] = { ...bad.experience[0], start: '2023' } as never;
    expect(checkProfile(bad)).toMatchObject({ ok: false });
    const dup = structuredClone(fake) as {
      skills: { id: string; name?: string; source?: string }[];
    };
    dup.skills[1] = { id: 'skill-1', name: 'Excel', source: 'cv' };
    expect(checkProfile(dup)).toEqual({ ok: false, errors: ['ids used twice: skill-1'] });
  });
});

describe('renderCvHtml', () => {
  const html = renderCvHtml(profile(), 'body{}');

  it('uses standard headings in a sensible order and skips empty sections', () => {
    const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual([
      'Summary',
      'Experience',
      'Education',
      'Skills',
      'Certifications',
      'Languages',
    ]);
  });

  it('formats dates and escapes text', () => {
    expect(html).toContain('Feb 2023 – Present');
    expect(formatMonth('2021-07')).toBe('Jul 2021');
    const tricky = { ...profile(), name: 'A <b>&</b> "B"' };
    expect(renderCvHtml(tricky, '')).toContain('A &lt;b&gt;&amp;&lt;/b&gt; &quot;B&quot;');
  });

  it('lets a long role continue on the next page, keeping its title line and dates together', () => {
    const css = readFileSync(new URL('../../plugin/templates/cv.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.item\s*\{[^}]*break-inside:\s*avoid/);
    expect(css).toMatch(/\.item-head\s*\{[^}]*break-after:\s*avoid/);
    expect(html).toMatch(/<div class="item-head">\s*<h3>Accountant/);
  });

  it('has no tables or images, which ATS parsers trip on', () => {
    expect(html).not.toMatch(/<table|<img/);
  });

  it('renders projects and education details when present', () => {
    const withMore: Profile = {
      ...profile(),
      summary: '',
      projects: [{ id: 'proj-1', name: 'Ledger app', description: 'A side project', bullets: [] }],
      education: [
        { id: 'edu-1', degree: 'BSc', institution: 'Example University', details: 'Gold medal' },
      ],
    };
    const out = renderCvHtml(withMore, '');
    expect(out).toContain('<h3>Ledger app</h3>');
    expect(out).toContain('<p>Gold medal</p>');
    expect(out).not.toContain('<h2>Summary</h2>');
  });
});

describe('profile store', () => {
  it('saves, logs counts only, and loads', async () => {
    const dir = await tempDir();
    await saveProfile(dir, profile());
    expect((await loadProfile(dir))?.name).toBe('Ayesha Example');
    const log = await readFile(join(dir, 'log.jsonl'), 'utf8');
    expect(log).toContain('"roles":2');
    expect(log).not.toContain('Ayesha');
  });

  it('is undefined when missing and throws when damaged', async () => {
    const dir = await tempDir();
    expect(await loadProfile(dir)).toBeUndefined();
    await writeFile(join(dir, 'profile.json'), '{}');
    await expect(loadProfile(dir)).rejects.toThrow(/profile.json is damaged/);
  });
});

describe('docxText', () => {
  const documentXml =
    '<w:document><w:body><w:p><w:r><w:t>Ayesha Example</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Accountant</w:t><w:tab/><w:t>2023 &amp; on</w:t></w:r></w:p></w:body></w:document>';

  it('reads paragraphs from a compressed or stored docx', () => {
    for (const store of [false, true]) {
      expect(
        docxText(
          makeZip({ '[Content_Types].xml': '<x/>', 'word/document.xml': documentXml }, store),
        ),
      ).toBe('Ayesha Example\nAccountant\t2023 & on');
    }
  });

  it('rejects files that are not Word documents', () => {
    expect(() => docxText(makeZip({ 'other.txt': 'hi' }))).toThrow(/Not a Word document/);
    expect(() => docxText(Buffer.from('plain text, not a zip at all'))).toThrow(
      /Not a Word document/,
    );
  });
});

describe('chrome', () => {
  it('honours JOB_HUNTER_CHROME and returns undefined when nothing is installed', async () => {
    const dir = await tempDir();
    const forced = join(dir, 'chrome');
    await writeFile(forced, '');
    expect(await findChrome({ JOB_HUNTER_CHROME: forced }, 'none')).toBe(forced);
    expect(await findChrome({}, 'none')).toBeUndefined();
  });

  it('prints a private PDF when a browser is installed', { timeout: 60_000 }, async () => {
    const chrome = await findChrome();
    if (chrome === undefined) return; // no browser on this machine
    const dir = await tempDir();
    const html = join(dir, 'cv.html');
    await writeFile(html, renderCvHtml(profile(), 'body{font-family:Arial}'));
    await printToPdf(chrome, html, join(dir, 'cv.pdf'));
    const pdf = await stat(join(dir, 'cv.pdf'));
    expect(pdf.size).toBeGreaterThan(1000);
    expect(pdf.mode & 0o777).toBe(0o600);
  });
});
