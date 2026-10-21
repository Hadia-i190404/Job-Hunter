import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadDoc } from '../../plugin/src/store/doc.ts';
import {
  addDrafts,
  approveDrafts,
  dropDrafts,
  moveToDrafts,
} from '../../plugin/src/store/drafts.ts';
import { DRAFTS } from '../../plugin/src/store/loop.ts';
import { checkProfile, loadProfile, saveProfile } from '../../plugin/src/store/profile.ts';
import { useTempDir } from './helpers.ts';

const tempDir = useTempDir();
const fake = JSON.parse(
  readFileSync(new URL('../fixtures/cv/fake-profile.json', import.meta.url), 'utf8'),
) as unknown;

async function withProfile(): Promise<string> {
  const dir = await tempDir();
  const checked = checkProfile(fake);
  if (!checked.ok) throw new Error('bad fixture');
  await saveProfile(dir, checked.profile);
  return dir;
}

describe('drafts', () => {
  it('moves bullets and skills out of the profile and back, as user facts', async () => {
    const dir = await withProfile();
    expect(
      await moveToDrafts(dir, ['exp-2-b1', 'skill-1', 'ghost'], 'overstated', new Date(0)),
    ).toEqual({
      moved: ['exp-2-b1', 'skill-1'],
      notFound: ['ghost'],
    });
    const moved = await loadProfile(dir);
    expect(moved?.experience[1]?.bullets).toEqual([]);
    expect(moved?.skills.map((s) => s.id)).toEqual(['skill-2', 'skill-3']);
    expect((await loadDoc(dir, DRAFTS)).drafts.map((d) => [d.id, d.kind, d.parentId])).toEqual([
      ['exp-2-b1', 'experience-bullet', 'exp-2'],
      ['skill-1', 'skill', undefined],
    ]);

    await approveDrafts(dir, ['exp-2-b1', 'skill-1'], new Date(0));
    const back = await loadProfile(dir);
    expect(back?.experience[1]?.bullets[0]).toMatchObject({
      id: 'exp-2-b1',
      source: 'user',
      addedAt: '1970-01-01T00:00:00.000Z',
    });
    expect(back?.skills.at(-1)).toMatchObject({ id: 'skill-1', source: 'user' });
    expect((await loadDoc(dir, DRAFTS)).drafts).toEqual([]);
  });

  it('places project bullets, leaves orphans in drafts, and drops on request', async () => {
    const dir = await withProfile();
    await addDrafts(dir, [
      { id: 'user-1', kind: 'project-bullet', parentId: 'proj-none', text: 'Orphan', why: 'gap' },
      {
        id: 'user-2',
        kind: 'experience-bullet',
        parentId: 'exp-1',
        text: 'Client calls',
        why: 'gap',
      },
    ]);
    expect(await approveDrafts(dir, ['user-1', 'user-2'])).toEqual({
      moved: ['user-2'],
      notFound: ['user-1'],
    });
    expect(await dropDrafts(dir, ['user-1'])).toBe(1);
    expect(await addDrafts(dir, [])).toBe(0);
  });

  it('refuses an approval that would duplicate an id, and needs a profile', async () => {
    const dir = await withProfile();
    await addDrafts(dir, [{ id: 'skill-1', kind: 'skill', text: 'Dup', why: 'x' }]);
    await expect(approveDrafts(dir, ['skill-1'])).rejects.toThrow(/would break the profile/);
    await expect(moveToDrafts(await tempDir(), ['x'], 'y')).rejects.toThrow(/No profile/);
  });
});
