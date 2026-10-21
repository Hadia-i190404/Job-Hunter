import { join } from 'node:path';
import { duplicateIds, profileSchema, type Profile } from '../schema/profile.ts';
import { DataFileError, readJson, writeJsonAtomic } from './json-file.ts';
import { logEvent } from './log.ts';
import { FILES } from './paths.ts';

export type CheckResult = { ok: true; profile: Profile } | { ok: false; errors: string[] };

export function checkProfile(data: unknown): CheckResult {
  const parsed = profileSchema(data, 'profile');
  if (!parsed.ok) return parsed;
  const duplicates = duplicateIds(parsed.value);
  if (duplicates.length > 0)
    return { ok: false, errors: [`ids used twice: ${duplicates.join(', ')}`] };
  return { ok: true, profile: parsed.value };
}

export async function saveProfile(dir: string, profile: Profile): Promise<void> {
  await writeJsonAtomic(join(dir, FILES.profile), profile);
  // Counts only: the log never holds CV content (spec R9).
  await logEvent(dir, {
    actor: 'agent',
    action: 'profile-saved',
    detail: { roles: profile.experience.length, skills: profile.skills.length },
  });
}

export async function loadProfile(dir: string): Promise<Profile | undefined> {
  const result = await readJson(join(dir, FILES.profile), profileSchema);
  if (result.status === 'corrupt') throw new DataFileError(FILES.profile, result.errors);
  return result.status === 'ok' ? result.value : undefined;
}
