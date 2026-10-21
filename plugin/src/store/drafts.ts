// Moving entries between the profile (approved facts) and drafts (D16): unapproved
// entries leave the profile; approved drafts come back marked as stated by the user.
import type { Profile } from '../schema/profile.ts';
import type { DraftsFile } from '../schema/loop.ts';
import { loadDoc, saveDoc } from './doc.ts';
import { DRAFTS } from './loop.ts';
import { checkProfile, loadProfile, saveProfile } from './profile.ts';

type Draft = DraftsFile['drafts'][number];
export type NewDraft = Omit<Draft, 'createdAt'>;

export interface MoveResult {
  moved: string[];
  notFound: string[];
}

// Take entries out of the profile into drafts, e.g. claims the user hasn't approved.
export async function moveToDrafts(
  dir: string,
  ids: readonly string[],
  why: string,
  now = new Date(),
): Promise<MoveResult> {
  const profile = await requireProfile(dir);
  const wanted = new Set(ids);
  const drafts: Draft[] = [];
  const createdAt = now.toISOString();
  const keepBullets =
    (parentId: string, kind: Draft['kind']) => (bullet: { id: string; text: string }) => {
      if (!wanted.has(bullet.id)) return true;
      drafts.push({ id: bullet.id, kind, parentId, text: bullet.text, why, createdAt });
      return false;
    };
  const next: Profile = {
    ...profile,
    experience: profile.experience.map((e) => ({
      ...e,
      bullets: e.bullets.filter(keepBullets(e.id, 'experience-bullet')),
    })),
    projects: profile.projects.map((p) => ({
      ...p,
      bullets: p.bullets.filter(keepBullets(p.id, 'project-bullet')),
    })),
    skills: profile.skills.filter((skill) => {
      if (!wanted.has(skill.id)) return true;
      drafts.push({ id: skill.id, kind: 'skill', text: skill.name, why, createdAt });
      return false;
    }),
  };
  await addDraftEntries(dir, drafts);
  await saveProfile(dir, next);
  const moved = drafts.map((d) => d.id);
  return { moved, notFound: ids.filter((id) => !moved.includes(id)) };
}

export async function addDrafts(
  dir: string,
  entries: readonly NewDraft[],
  now = new Date(),
): Promise<number> {
  await addDraftEntries(
    dir,
    entries.map((e) => ({ ...e, createdAt: now.toISOString() })),
  );
  return entries.length;
}

// Approved drafts become profile facts with source 'user' (D16).
export async function approveDrafts(
  dir: string,
  ids: readonly string[],
  now = new Date(),
): Promise<MoveResult> {
  const [profile, file] = await Promise.all([requireProfile(dir), loadDoc(dir, DRAFTS)]);
  const approved = file.drafts.filter((d) => ids.includes(d.id));
  const addedAt = now.toISOString();
  const fact = (d: Draft) => ({ id: d.id, text: d.text, source: 'user' as const, addedAt });
  const next: Profile = {
    ...profile,
    experience: profile.experience.map((e) => ({
      ...e,
      bullets: [
        ...e.bullets,
        ...approved.filter((d) => d.kind === 'experience-bullet' && d.parentId === e.id).map(fact),
      ],
    })),
    projects: profile.projects.map((p) => ({
      ...p,
      bullets: [
        ...p.bullets,
        ...approved.filter((d) => d.kind === 'project-bullet' && d.parentId === p.id).map(fact),
      ],
    })),
    skills: [
      ...profile.skills,
      ...approved
        .filter((d) => d.kind === 'skill')
        .map((d) => ({ id: d.id, name: d.text, source: 'user' as const, addedAt })),
    ],
  };
  const checked = checkProfile(next);
  if (!checked.ok)
    throw new Error(`Approving would break the profile: ${checked.errors.join('; ')}`);
  const placed = new Set(collectIds(next));
  const moved = approved.map((d) => d.id).filter((id) => placed.has(id));
  await saveProfile(dir, checked.profile);
  await saveDoc(dir, DRAFTS, { drafts: file.drafts.filter((d) => !moved.includes(d.id)) });
  return { moved, notFound: ids.filter((id) => !moved.includes(id)) };
}

export async function dropDrafts(dir: string, ids: readonly string[]): Promise<number> {
  const file = await loadDoc(dir, DRAFTS);
  const kept = file.drafts.filter((d) => !ids.includes(d.id));
  await saveDoc(dir, DRAFTS, { drafts: kept });
  return file.drafts.length - kept.length;
}

async function addDraftEntries(dir: string, entries: readonly Draft[]): Promise<void> {
  if (entries.length === 0) return;
  const file = await loadDoc(dir, DRAFTS);
  const byId = new Map(file.drafts.map((d) => [d.id, d]));
  for (const entry of entries) byId.set(entry.id, entry);
  await saveDoc(dir, DRAFTS, { drafts: [...byId.values()] });
}

async function requireProfile(dir: string): Promise<Profile> {
  const profile = await loadProfile(dir);
  if (profile === undefined) throw new Error('No profile yet: run /job-hunter:cv first');
  return profile;
}

function collectIds(profile: Profile): string[] {
  return [
    ...profile.experience.flatMap((e) => e.bullets.map((b) => b.id)),
    ...profile.projects.flatMap((p) => p.bullets.map((b) => b.id)),
    ...profile.skills.map((s) => s.id),
  ];
}
