import { join } from 'node:path';
import { logEventSchema, type LogEvent } from '../schema/files.ts';
import { appendJsonLine, readJsonLines, type LineReport } from './jsonl.ts';
import { FILES } from './paths.ts';

export type NewLogEvent = Omit<LogEvent, 'at'>;

// Every agent action and every user "done" is logged (spec R9). Detail holds counts
// and ids only: never CV text, answers or contact details.
export async function logEvent(dir: string, event: NewLogEvent, now = new Date()): Promise<void> {
  await appendJsonLine(join(dir, FILES.log), { at: now.toISOString(), ...event });
}

export function readLog(dir: string, report?: LineReport): AsyncGenerator<LogEvent> {
  return readJsonLines(join(dir, FILES.log), logEventSchema, report);
}
