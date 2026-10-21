// applications.json: one record per job Job Hunter prepared (S1.6), moved through
// needs-you → prepared → approved → submitted (or skipped / failed) by the review (S1.7).
import type { ApplicationsFile } from '../schema/loop.ts';
import { loadDoc, saveDoc } from '../store/doc.ts';
import { logEvent } from '../store/log.ts';
import { APPLICATIONS } from '../store/loop.ts';
import type { Prepared } from './prepare.ts';

export type Application = ApplicationsFile['applications'][number];
type Status = Application['status'];

export interface NewApplication {
  jobId: string;
  searchId: string;
  jobTitle: string;
  company: string;
  url: string;
  applyLevel: 'B' | 'C';
  cvPath?: string;
  prepared: Prepared;
}

export async function addApplication(
  dir: string,
  input: NewApplication,
  now = new Date(),
): Promise<Application> {
  const file = await loadDoc(dir, APPLICATIONS);
  const existing = file.applications.find((a) => a.jobId === input.jobId);
  if (existing !== undefined) return existing;
  const stamp = now.toISOString();
  const application: Application = {
    id: `app-${String(file.applications.length + 1)}`,
    jobId: input.jobId,
    searchId: input.searchId,
    status: input.prepared.todo.length > 0 ? 'needs-you' : 'prepared',
    answers: input.prepared.answers,
    todo: input.prepared.todo,
    noAi: input.prepared.noAi,
    jobTitle: input.jobTitle,
    company: input.company,
    url: input.url,
    applyLevel: input.applyLevel,
    preparedAt: stamp,
    updatedAt: stamp,
  };
  if (input.cvPath !== undefined) application.cvPath = input.cvPath;
  if (input.prepared.noAi)
    application.note =
      'This employer forbids AI-written answers: every free-text answer is yours to write (D19).';
  await saveDoc(dir, APPLICATIONS, { applications: [...file.applications, application] });
  await logEvent(
    dir,
    {
      actor: 'agent',
      action: 'application-prepared',
      detail: { id: application.id, todo: application.todo.length },
    },
    now,
  );
  return application;
}

export async function updateApplication(
  dir: string,
  id: string,
  change: (app: Application) => Application,
  now = new Date(),
): Promise<Application> {
  const file = await loadDoc(dir, APPLICATIONS);
  const current = file.applications.find((a) => a.id === id);
  if (current === undefined) throw new Error(`No application ${id}`);
  const next = { ...change(current), updatedAt: now.toISOString() };
  await saveDoc(dir, APPLICATIONS, {
    applications: file.applications.map((a) => (a.id === id ? next : a)),
  });
  return next;
}

// Who moved it: the user approves and confirms; the agent marks submitted/failed while
// the user watches (D21). Every move is logged (R9).
export async function setStatus(
  dir: string,
  id: string,
  change: { status: Status; actor: 'agent' | 'user'; note?: string },
): Promise<Application> {
  const { status, actor, note } = change;
  const app = await updateApplication(dir, id, (a) => ({
    ...a,
    status,
    ...(note === undefined ? {} : { note }),
  }));
  await logEvent(dir, { actor, action: `application-${status}`, detail: { id } });
  return app;
}

export function setAnswer(
  app: Application,
  index: number,
  answer: string,
  from: 'user' | 'claude',
): Application {
  const question = app.answers[index];
  if (question === undefined) throw new Error(`Question ${String(index)} doesn't exist`);
  const answers = app.answers.map((a, i) => (i === index ? { ...a, answer, from } : a));
  const label = question.question.slice(0, 40);
  const todo = app.todo.filter((t) => !t.includes(label));
  const status: Status = app.status === 'needs-you' && todo.length === 0 ? 'prepared' : app.status;
  return { ...app, answers, todo, status };
}
