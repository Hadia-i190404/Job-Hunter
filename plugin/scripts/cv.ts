// CV commands for the cv skill. Prints one JSON object (never CV content except for
// docx-text, which the skill asked for). Usage: sh run.sh cv.ts <command> …
//   docx-text <file.docx>     plain text of a Word CV
//   save-profile <draft.json> validate and save as ~/JobHunter/profile.json
//   render                    profile → ~/JobHunter/cv/<Name>-CV.html and .pdf
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findChrome, printToPdf } from '../src/cv/chrome.ts';
import { docxText } from '../src/cv/docx-text.ts';
import { renderCvHtml } from '../src/cv/render.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { dataDir } from '../src/store/paths.ts';
import { checkProfile, loadProfile, saveProfile } from '../src/store/profile.ts';

const dir = dataDir();
const [command = '', arg] = process.argv.slice(2);

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  switch (command) {
    case 'docx-text':
      return arg === undefined ? usage() : { text: docxText(await readFile(arg)) };
    case 'save-profile':
      return arg === undefined ? usage() : saveDraft(arg);
    case 'render':
      return render();
    default:
      return usage();
  }
}

async function saveDraft(path: string): Promise<unknown> {
  const checked = checkProfile(JSON.parse(await readFile(path, 'utf8')) as unknown);
  if (!checked.ok) return { error: 'invalid-profile', problems: checked.errors };
  await saveProfile(dir, checked.profile);
  const p = checked.profile;
  return {
    saved: join(dir, 'profile.json'),
    counts: {
      roles: p.experience.length,
      education: p.education.length,
      skills: p.skills.length,
      projects: p.projects.length,
    },
  };
}

async function render(): Promise<unknown> {
  const profile = await loadProfile(dir);
  if (profile === undefined) return { error: 'no-profile' };
  const chrome = await findChrome();
  if (chrome === undefined)
    return { error: 'no-chrome', hint: 'Install Google Chrome, or set JOB_HUNTER_CHROME' };
  const style = await readFile(new URL('../templates/cv.css', import.meta.url), 'utf8');
  const base = `${profile.name
    .trim()
    .split(/\s+/)
    .join('-')
    .replace(/[^\p{L}\p{N}-]/gu, '')}-CV`;
  const out = join(dir, 'cv');
  await mkdir(out, { recursive: true, mode: 0o700 });
  const html = join(out, `${base}.html`);
  const pdf = join(out, `${base}.pdf`);
  await writeFile(html, renderCvHtml(profile, style), { mode: 0o600 });
  await printToPdf(chrome, html, pdf);
  return { html, pdf };
}

function usage(): unknown {
  return { error: 'usage', usage: 'docx-text <file> | save-profile <draft.json> | render' };
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
