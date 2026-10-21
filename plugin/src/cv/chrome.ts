// Print HTML to PDF with the user's own Chrome (or Edge/Brave/Chromium), headless and with
// a throwaway profile so it never touches their open browser or its sign-ins.
import { execFile } from 'node:child_process';
import { access, chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const CANDIDATES: Record<string, readonly string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export async function findChrome(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): Promise<string | undefined> {
  const forced = env.JOB_HUNTER_CHROME;
  const list = [...(forced ? [forced] : []), ...(CANDIDATES[platform] ?? [])];
  const found = await Promise.all(
    list.map((path) =>
      access(path).then(
        () => true,
        () => false,
      ),
    ),
  );
  // First match wins, in order: the user's forced choice, then Chrome, Edge, Brave…
  return list[found.indexOf(true)];
}

export async function printToPdf(chrome: string, htmlPath: string, pdfPath: string): Promise<void> {
  const profile = await mkdtemp(join(tmpdir(), 'job-hunter-chrome-'));
  try {
    await run(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pdf-header-footer',
        `--user-data-dir=${profile}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { timeout: 60_000 },
    );
    // Chrome writes the PDF readable by everyone; a CV is for the user only (spec R9).
    await chmod(pdfPath, 0o600);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}
