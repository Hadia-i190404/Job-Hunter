// Turn a tailored CV (checked by honesty.ts) into the profile shape the renderer prints,
// and measure how well it covers the job's skills (the ATS check, R5).
import type { Profile } from '../schema/profile.ts';
import type { Tailored } from '../schema/tailored.ts';

export function applyTailoring(profile: Profile, tailored: Tailored): Profile {
  const roles = new Map(profile.experience.map((e) => [e.id, e]));
  const projects = new Map(profile.projects.map((p) => [p.id, p]));
  const keep = <T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] =>
    ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is T => item !== undefined);
  return {
    ...profile,
    headline: tailored.headline,
    summary: tailored.summary,
    experience: tailored.experience.flatMap(({ roleId, bullets }) => {
      const role = roles.get(roleId);
      return role === undefined
        ? []
        : [
            {
              ...role,
              bullets: bullets.map((b, i) => ({
                id: `${roleId}-t${String(i)}`,
                text: b.text,
                source: 'cv' as const,
              })),
            },
          ];
    }),
    projects: tailored.projects.flatMap(({ projectId, bullets }) => {
      const project = projects.get(projectId);
      return project === undefined
        ? []
        : [
            {
              ...project,
              bullets: bullets.map((b, i) => ({
                id: `${projectId}-t${String(i)}`,
                text: b.text,
                source: 'cv' as const,
              })),
            },
          ];
    }),
    skills: tailored.skills.map((s, i) => ({
      id: `skill-t${String(i)}`,
      name: s.text,
      source: 'cv' as const,
    })),
    education: keep(profile.education, tailored.educationIds),
    certifications: keep(profile.certifications, tailored.certificationIds),
    languages: tailored.languages ? profile.languages : [],
  };
}

export interface Coverage {
  // The job asks for these and the CV says them.
  covered: string[];
  // The job asks for these, the profile has them, but this CV doesn't say them.
  missingButTrue: string[];
  // The job asks for these and the profile doesn't have them: gaps (R5b).
  gaps: string[];
}

// Uses the profile's skills plus the search's skills as the vocabulary: what the job
// mentions from that list should appear in the CV when the profile backs it.
export function keywordCoverage(
  jobText: string,
  cvText: string,
  profile: Profile,
  searchSkills: readonly string[],
): Coverage {
  const vocabulary = [...new Set([...profile.skills.map((s) => s.name), ...searchSkills])];
  const inJob = vocabulary.filter((term) => mentions(jobText, term));
  const profileText = JSON.stringify(profile);
  return {
    covered: inJob.filter((term) => mentions(cvText, term)),
    missingButTrue: inJob.filter((term) => !mentions(cvText, term) && mentions(profileText, term)),
    gaps: inJob.filter((term) => !mentions(profileText, term)),
  };
}

function mentions(text: string, term: string): boolean {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text.toLowerCase());
}
