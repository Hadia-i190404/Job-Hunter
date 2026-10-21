// Tailored CVs (S1.5). Prints one JSON object.
// Usage: sh run.sh tailor.ts <command>
//   context <jobId>          the job, why it matched, the search and the profile, for Claude
//   render <tailored.json>   honesty check → PDF in ~/JobHunter/cv/tailored/ → pages, keywords
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { countPdfPages, findChrome, printToPdf } from '../src/cv/chrome.ts';
import { checkHonesty } from '../src/cv/honesty.ts';
import { renderCvHtml } from '../src/cv/render.ts';
import { applyTailoring, keywordCoverage } from '../src/cv/tailor.ts';
import type { Profile } from '../src/schema/profile.ts';
import { tailoredSchema, type Tailored } from '../src/schema/tailored.ts';
import { loadDoc, saveDoc } from '../src/store/doc.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { loadJobs } from '../src/store/jobs.ts';
import { GAPS, MATCHES, SEARCHES } from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';
import { loadProfile } from '../src/store/profile.ts';
import { loadSettings } from '../src/store/settings.ts';

const dir = dataDir();
const [command = '', arg] = process.argv.slice(2);

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  if (command === 'context' && arg !== undefined) return context(arg);
  if (command === 'render' && arg !== undefined) return render(arg);
  return { error: 'usage', commands: 'context <jobId> | render <tailored.json>' };
}

async function context(jobId: string): Promise<unknown> {
  const [jobs, matches, searches, profile] = await Promise.all([
    loadJobs(dir),
    loadDoc(dir, MATCHES),
    loadDoc(dir, SEARCHES),
    loadProfile(dir),
  ]);
  const job = jobs.get(jobId);
  if (job === undefined) return { error: 'no such job' };
  if (profile === undefined) return { error: 'no-profile' };
  const match = matches.items.find((i) => i.jobId === jobId);
  const search = searches.searches.find((s) => s.id === match?.searchId);
  return { job, match: match ?? null, search: search ?? null, profile };
}

async function render(path: string): Promise<unknown> {
  const parsed = tailoredSchema(JSON.parse(await readFile(path, 'utf8')) as unknown, 'tailored');
  if (!parsed.ok) return { error: 'invalid-tailored', problems: parsed.errors };
  const tailored = parsed.value;
  const [profile, jobs, settings] = await Promise.all([
    loadProfile(dir),
    loadJobs(dir),
    loadSettings(dir),
  ]);
  const job = jobs.get(tailored.jobId);
  if (profile === undefined) return { error: 'no-profile' };
  if (job === undefined) return { error: 'no such job' };

  const honesty = checkHonesty(tailored, profile, settings.clientNames ?? []);
  if (!honesty.ok) return { error: 'honesty', problems: honesty.problems };
  const chrome = await findChrome();
  if (chrome === undefined) return { error: 'no-chrome' };
  const { pdf, html } = await print(chrome, profile, tailored, job.company);
  const coverage = keywordCoverage(
    `${job.title}\n${job.description}`,
    html.replace(/<[^>]+>/g, ' '),
    profile,
    await searchSkills(job.id),
  );
  await recordGaps(coverage.gaps);
  const pages = await countPdfPages(pdf);
  return { pdf, pages, tooLong: pages > 2, coverage };
}

async function print(
  chrome: string,
  profile: Profile,
  tailored: Tailored,
  company: string,
): Promise<{ pdf: string; html: string }> {
  const style = await readFile(new URL('../templates/cv.css', import.meta.url), 'utf8');
  const html = renderCvHtml(applyTailoring(profile, tailored), style);
  const base = `${slug(profile.name)}-CV-${slug(company) || 'Job'}`;
  const out = join(dir, 'cv', 'tailored');
  await mkdir(out, { recursive: true, mode: 0o700 });
  await writeFile(join(out, `${base}.html`), html, { mode: 0o600 });
  await writeFile(join(out, `${base}.json`), JSON.stringify(tailored, null, 2), { mode: 0o600 });
  const pdf = join(out, `${base}.pdf`);
  await printToPdf(chrome, join(out, `${base}.html`), pdf);
  return { pdf, html };
}

// The skills of the search this job matched, as extra keyword vocabulary.
async function searchSkills(jobId: string): Promise<string[]> {
  const [matches, searches] = await Promise.all([loadDoc(dir, MATCHES), loadDoc(dir, SEARCHES)]);
  const searchId = matches.items.find((i) => i.jobId === jobId)?.searchId;
  const search = searches.searches.find((s) => s.id === searchId);
  return [...(search?.mustSkills ?? []), ...(search?.niceSkills ?? [])];
}

// Requirements the profile can't back become gap questions for the daily list (R5b, D20).
async function recordGaps(areas: readonly string[]): Promise<void> {
  const file = await loadDoc(dir, GAPS);
  const known = new Set(file.gaps.map((g) => g.area.toLowerCase()));
  const fresh = areas.filter((area) => !known.has(area.toLowerCase()));
  if (fresh.length === 0) return;
  const askedAt = new Date().toISOString();
  await saveDoc(dir, GAPS, {
    gaps: [
      ...file.gaps,
      ...fresh.map((area) => ({ area, askedAt, outcome: 'pending' as const, entryIds: [] })),
    ],
  });
}

function slug(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .join('-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}

run().then(
  (result) => {
    console.log(JSON.stringify(result, null, 2));
    if (typeof result === 'object' && result !== null && 'error' in result) process.exitCode = 1;
  },
  (error: unknown) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  },
);
