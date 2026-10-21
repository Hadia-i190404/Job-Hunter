// Commands for the setup interview (/job-hunter:setup). Prints one JSON object.
// Usage: sh run.sh setup.ts <command> [args]
//   show                         everything setup needs: profile, searches, answers, gaps, drafts
//   save-searches <file.json>    [Search, …] → searches.json (re-opens the gate)
//   confirm                      confirm the current searches (opens the gate)
//   save-answers <file.json>     [{key, question, answer, kind}, …] → answer bank
//   to-drafts <why> <id> [id…]   move profile entries the user hasn't approved into drafts
//   add-drafts <file.json>       [{id, kind, parentId?, text, why}, …] → drafts
//   approve <id> [id…]           drafts → profile, as stated by the user
//   drop <id> [id…]              delete drafts
//   gap <area> <added|none|pending> [entry ids…]
import { readFile } from 'node:fs/promises';
import { searchesSchema } from '../src/schema/loop.ts';
import { loadDoc, saveDoc } from '../src/store/doc.ts';
import {
  addDrafts,
  approveDrafts,
  dropDrafts,
  moveToDrafts,
  type NewDraft,
} from '../src/store/drafts.ts';
import { openDataFolder } from '../src/store/folder.ts';
import {
  ANSWERS,
  confirmSearches,
  DRAFTS,
  GAPS,
  isConfirmed,
  saveSearches,
  SEARCHES,
  upsertAnswers,
} from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';
import { loadProfile } from '../src/store/profile.ts';

const dir = dataDir();
const [command = '', ...args] = process.argv.slice(2);

const readJsonFile = async (path: string | undefined): Promise<unknown> => {
  if (path === undefined) throw new Error('missing file argument');
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
};

async function show(): Promise<unknown> {
  const [profile, searches, answers, gaps, drafts] = await Promise.all([
    loadProfile(dir),
    loadDoc(dir, SEARCHES),
    loadDoc(dir, ANSWERS),
    loadDoc(dir, GAPS),
    loadDoc(dir, DRAFTS),
  ]);
  return {
    profile: profile ?? null,
    searches,
    confirmed: isConfirmed(searches),
    answers,
    gaps,
    drafts,
  };
}

async function saveSearchList(path: string | undefined): Promise<unknown> {
  const list = await readJsonFile(path);
  const checked = searchesSchema({ version: 1, searches: list }, 'searches');
  if (!checked.ok) return { error: 'invalid-searches', problems: checked.errors };
  const saved = await saveSearches(dir, checked.value.searches);
  return { saved: saved.searches.length, version: saved.version, confirmed: false };
}

async function recordGap(
  area: string | undefined,
  outcome: string | undefined,
  ids: string[],
): Promise<unknown> {
  if (area === undefined || (outcome !== 'added' && outcome !== 'none' && outcome !== 'pending')) {
    return { error: 'usage', usage: 'gap <area> <added|none|pending> [ids…]' };
  }
  const file = await loadDoc(dir, GAPS);
  const others = file.gaps.filter((gap) => gap.area !== area);
  await saveDoc(dir, GAPS, {
    gaps: [...others, { area, askedAt: new Date().toISOString(), outcome, entryIds: ids }],
  });
  return { area, outcome };
}

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  switch (command) {
    case 'show':
      return show();
    case 'save-searches':
      return saveSearchList(args[0]);
    case 'confirm':
      return { confirmedAt: (await confirmSearches(dir)).confirmedAt };
    case 'save-answers':
      return {
        answers: (await upsertAnswers(dir, (await readJsonFile(args[0])) as never)).answers.length,
      };
    case 'to-drafts':
      return moveToDrafts(dir, args.slice(1), args[0] ?? 'not approved by the user');
    case 'add-drafts':
      return { added: await addDrafts(dir, (await readJsonFile(args[0])) as NewDraft[]) };
    case 'approve':
      return approveDrafts(dir, args);
    case 'drop':
      return { dropped: await dropDrafts(dir, args) };
    case 'gap':
      return recordGap(args[0], args[1], args.slice(2));
    default:
      return {
        error: 'usage',
        commands:
          'show | save-searches | confirm | save-answers | to-drafts | add-drafts | approve | drop | gap',
      };
  }
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
