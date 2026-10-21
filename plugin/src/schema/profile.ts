// The master profile: the only source of facts for every CV, message and answer (spec R1,
// R5). Every item has an id so a tailored CV can cite where each line came from (P2).
import { arrayOf, isoDate, number, object, oneOf, optional, string, type Infer } from './core.ts';

const id = string({ pattern: /^[a-z][a-z0-9-]{0,40}$/, hint: 'an id like "exp-1"' });
// "2024-03", or "present" for a current role.
const month = string({
  pattern: /^\d{4}-(0[1-9]|1[0-2])$|^present$/,
  hint: 'YYYY-MM or "present"',
});
const text = string({ minLength: 1 });

// Where a fact came from (D16): read from the CV, or stated and approved by the user.
// Schema v2; v1 profiles are migrated with every entry marked 'cv'.
const source = oneOf(['cv', 'user'] as const);
const provenance = { source, addedAt: optional(isoDate()) };

const bullet = object({ id, text, ...provenance });

export const profileSchema = object({
  name: text,
  headline: optional(string()),
  contact: object({
    email: optional(string()),
    phone: optional(string()),
    city: optional(string()),
    links: arrayOf(string()),
  }),
  summary: string(),
  experience: arrayOf(
    object({
      id,
      title: text,
      company: text,
      location: optional(string()),
      start: month,
      end: month,
      bullets: arrayOf(bullet),
    }),
  ),
  education: arrayOf(
    object({
      id,
      degree: text,
      institution: text,
      start: optional(month),
      end: optional(month),
      details: optional(string()),
    }),
  ),
  skills: arrayOf(object({ id, name: text, ...provenance })),
  certifications: arrayOf(
    object({
      id,
      name: text,
      issuer: optional(string()),
      year: optional(number({ integer: true, min: 1950, max: 2100 })),
      ...provenance,
    }),
  ),
  languages: arrayOf(object({ name: text, level: optional(string()) })),
  projects: arrayOf(
    object({ id, name: text, description: optional(string()), bullets: arrayOf(bullet) }),
  ),
});

export type Profile = Infer<typeof profileSchema>;

// Ids must be unique across the whole profile, so a citation points at exactly one thing.
export function duplicateIds(profile: Profile): string[] {
  const ids = [
    ...profile.experience.flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]),
    ...profile.education.map((e) => e.id),
    ...profile.skills.map((s) => s.id),
    ...profile.certifications.map((c) => c.id),
    ...profile.projects.flatMap((p) => [p.id, ...p.bullets.map((b) => b.id)]),
  ];
  return [...new Set(ids.filter((value, index) => ids.indexOf(value) !== index))];
}
