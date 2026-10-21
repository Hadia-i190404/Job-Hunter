// Prepared applications (S1.6) and their review (S1.7). Prints one JSON object.
// Usage: sh run.sh apply.ts <command>
//   prepare <jobId> <cvPath>               read the form, answer what's known, save
//   list                                   applications waiting for the user
//   show <appId>                           one application in full
//   answer <appId> <index> <user|claude> <text…>   fill one question
//   status <appId> <approved|submitted|skipped|failed> [note…]
import {
  addApplication,
  setAnswer,
  setStatus,
  updateApplication,
} from '../src/apply/applications.ts';
import { prepareAnswers, type Prepared } from '../src/apply/prepare.ts';
import { greenhouseQuestions } from '../src/apply/questions.ts';
import { createHttpClient } from '../src/connectors/http.ts';
import type { Job } from '../src/pipeline/job.ts';
import type { AnswersFile } from '../src/schema/loop.ts';
import type { Profile } from '../src/schema/profile.ts';
import { loadDoc } from '../src/store/doc.ts';
import { openDataFolder } from '../src/store/folder.ts';
import { loadJobs } from '../src/store/jobs.ts';
import { ANSWERS, APPLICATIONS, MATCHES } from '../src/store/loop.ts';
import { dataDir } from '../src/store/paths.ts';
import { loadProfile } from '../src/store/profile.ts';

const dir = dataDir();
const [command = '', ...args] = process.argv.slice(2);
const STATUSES = ['approved', 'submitted', 'skipped', 'failed'] as const;

async function run(): Promise<unknown> {
  const opened = await openDataFolder(dir);
  if (opened !== 'ok') return { error: opened };
  switch (command) {
    case 'prepare':
      return prepare(args[0], args[1]);
    case 'list':
      return list();
    case 'show':
      return (
        (await loadDoc(dir, APPLICATIONS)).applications.find((a) => a.id === args[0]) ?? {
          error: 'no such application',
        }
      );
    case 'answer':
      return answer(args[0], Number(args[1]), args[2], args.slice(3).join(' '));
    case 'status':
      return status(args[0], args[1], args.slice(2).join(' '));
    default:
      return { error: 'usage', commands: 'prepare | list | show | answer | status' };
  }
}

async function prepare(jobId: string | undefined, cvPath: string | undefined): Promise<unknown> {
  if (jobId === undefined || cvPath === undefined)
    return { error: 'usage', usage: 'prepare <jobId> <cvPath>' };
  const [jobs, matches, profile, bank] = await Promise.all([
    loadJobs(dir),
    loadDoc(dir, MATCHES),
    loadProfile(dir),
    loadDoc(dir, ANSWERS),
  ]);
  const job = jobs.get(jobId);
  if (job === undefined) return { error: 'no such job' };
  if (profile === undefined) return { error: 'no-profile' };
  const item = matches.items.find((i) => i.jobId === jobId);
  const prepared = await prepareFor(job, profile, bank.answers, cvPath);
  if (prepared === undefined) return { error: 'could not read the application form' };
  const app = await addApplication(dir, {
    jobId,
    searchId: item?.searchId ?? 'manual',
    jobTitle: job.title,
    company: job.company,
    url: job.url,
    applyLevel: job.source === 'greenhouse' ? 'B' : 'C',
    cvPath,
    prepared,
  });
  return {
    id: app.id,
    status: app.status,
    todo: app.todo,
    noAi: app.noAi ?? false,
    answered: app.answers.filter((a) => a.from !== 'todo').length,
    questions: app.answers.length,
  };
}

async function prepareFor(
  job: Job,
  profile: Profile,
  bank: AnswersFile['answers'],
  cvPath: string,
): Promise<Prepared | undefined> {
  if (job.source !== 'greenhouse') {
    // Sites Job Hunter can't fill (level C): the user applies from a ready card.
    return {
      answers: [],
      noAi: false,
      todo: [`Apply on ${job.source} yourself: ${job.url} (your tailored CV: ${cvPath})`],
    };
  }
  const [board = '', id = ''] = job.sourceId.split(/-(?=\d+$)/);
  const questions = await greenhouseQuestions(createHttpClient(), board, id);
  return questions === undefined ? undefined : prepareAnswers(questions, profile, bank, cvPath);
}

async function list(): Promise<unknown> {
  const apps = (await loadDoc(dir, APPLICATIONS)).applications;
  const waiting = apps.filter(
    (a) => a.status === 'prepared' || a.status === 'needs-you' || a.status === 'approved',
  );
  return {
    waiting: waiting.map((a) => ({
      id: a.id,
      status: a.status,
      title: a.jobTitle,
      company: a.company,
      level: a.applyLevel,
      todo: a.todo,
      url: a.url,
    })),
    submitted: apps.filter((a) => a.status === 'submitted').length,
  };
}

async function answer(
  id: string | undefined,
  index: number,
  from: string | undefined,
  text: string,
): Promise<unknown> {
  if (
    id === undefined ||
    (from !== 'user' && from !== 'claude') ||
    text === '' ||
    !Number.isInteger(index)
  ) {
    return { error: 'usage', usage: 'answer <appId> <index> <user|claude> <text>' };
  }
  const apps = (await loadDoc(dir, APPLICATIONS)).applications;
  // D19: on a no-AI form, Claude may not write answers; only the user's own words go in.
  if (from === 'claude' && apps.find((a) => a.id === id)?.noAi === true)
    return { error: 'no-ai-form' };
  const app = await updateApplication(dir, id, (a) => setAnswer(a, index, text, from));
  return { id: app.id, status: app.status, todo: app.todo };
}

async function status(
  id: string | undefined,
  next: string | undefined,
  note: string,
): Promise<unknown> {
  const value = STATUSES.find((s) => s === next);
  if (id === undefined || value === undefined)
    return { error: 'usage', usage: `status <appId> <${STATUSES.join('|')}> [note]` };
  const actor = value === 'approved' || value === 'skipped' ? 'user' : 'agent';
  const app = await setStatus(dir, id, { status: value, actor, ...(note === '' ? {} : { note }) });
  return { id: app.id, status: app.status };
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
