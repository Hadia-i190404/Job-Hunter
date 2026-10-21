// The daily hunt. Prints one JSON object.
// Usage: sh run.sh hunt.ts <command>
//   run                      search all sources for the confirmed searches, rank, save
//   list [count]             today's ranked list (default 15)
//   job <jobId>              one saved job in full, for Claude to read
//   judge <jobId> <eligible|likely|not-eligible> <reason…>   Claude's verdict on an unclear job
import { readFile } from 'node:fs/promises';
import { createHttpClient } from '../src/connectors/http.ts';
import { connectors } from '../src/connectors/registry.ts';
import { runHunt } from '../src/hunt/run.ts';
import { loadDoc, saveDoc } from '../src/store/doc.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { loadJobs } from '../src/store/jobs.ts';
import { isConfirmed, MATCHES, SEARCHES } from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';
import { loadSettings } from '../src/store/settings.ts';

const dir = dataDir();
const [command = '', ...args] = process.argv.slice(2);
// How many unclear jobs Claude may read per run (spec D11).
const CLAUDE_BUDGET = { light: 25, full: 60 } as const;

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  switch (command) {
    case 'run':
      return hunt();
    case 'list':
      return list(Number(args[0] ?? 15));
    case 'job':
      return (await loadJobs(dir)).get(args[0] ?? '') ?? { error: 'no such job' };
    case 'judge':
      return judge(args[0], args[1], args.slice(2).join(' '));
    default:
      return {
        error: 'usage',
        commands: 'run | list [n] | job <id> | judge <id> <verdict> <reason>',
      };
  }
}

async function hunt(): Promise<unknown> {
  const settings = await loadSettings(dir);
  if (settings.paused) return { paused: true };
  const searches = await loadDoc(dir, SEARCHES);
  if (!isConfirmed(searches))
    return { error: 'not-confirmed', hint: 'run /job-hunter:setup first' };
  const boards = JSON.parse(
    await readFile(new URL('../shared/greenhouse-boards.json', import.meta.url), 'utf8'),
  ) as { boards: string[] };
  const enabled = connectors({ greenhouseBoards: boards.boards }).filter(
    (c) => settings.platforms[c.id] !== false,
  );
  const result = await runHunt(dir, searches.searches, {
    http: createHttpClient(),
    connectors: enabled,
  });
  return { ...result, claudeBudget: CLAUDE_BUDGET[settings.usage], top: (await list(15)).items };
}

async function list(count: number): Promise<{ runAt: string; total: number; items: unknown[] }> {
  const file = await loadDoc(dir, MATCHES);
  return { runAt: file.runAt, total: file.items.length, items: file.items.slice(0, count) };
}

async function judge(
  jobId: string | undefined,
  verdict: string | undefined,
  reason: string,
): Promise<unknown> {
  if (
    jobId === undefined ||
    (verdict !== 'eligible' && verdict !== 'likely' && verdict !== 'not-eligible') ||
    reason === ''
  ) {
    return { error: 'usage', usage: 'judge <jobId> <eligible|likely|not-eligible> <reason>' };
  }
  const file = await loadDoc(dir, MATCHES);
  const item = file.items.find((i) => i.jobId === jobId);
  if (item === undefined) return { error: 'not in today’s list' };
  const items =
    verdict === 'not-eligible'
      ? file.items.filter((i) => i.jobId !== jobId)
      : file.items.map((i) =>
          i.jobId === jobId
            ? {
                ...i,
                verdict,
                needsClaude: false,
                verdictReasons: [`${reason} (checked by Claude)`],
              }
            : i,
        );
  await saveDoc(dir, MATCHES, { ...file, items });
  return { jobId, verdict, remaining: items.length };
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
