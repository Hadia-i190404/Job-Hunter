// The honesty check (R5, D16): a tailored CV may select, order and reword profile facts,
// never add one. Run on every tailored CV before it is rendered.
import type { Profile } from '../schema/profile.ts';
import type { Tailored } from '../schema/tailored.ts';

export interface HonestyReport {
  ok: boolean;
  problems: string[];
}

// "34,000", "35%", "3+", "2023", "99.9" — any figure a reader would take as a claim.
const NUMBER = /\d[\d,]*(?:\.\d+)?\s*(?:%|\+|k\b|m\b)?/gi;

export function checkHonesty(
  tailored: Tailored,
  profile: Profile,
  clientNames: readonly string[] = [],
): HonestyReport {
  const facts = factIndex(profile);
  const problems: string[] = [];

  for (const role of tailored.experience) {
    const source = profile.experience.find((e) => e.id === role.roleId);
    if (source === undefined) {
      problems.push(`Experience ${role.roleId} isn't in the profile`);
      continue;
    }
    const own = new Set(source.bullets.map((b) => b.id));
    for (const line of role.bullets)
      problems.push(...checkLine(line, facts, (id) => own.has(id), source.title));
  }
  for (const project of tailored.projects) {
    const source = profile.projects.find((p) => p.id === project.projectId);
    if (source === undefined) {
      problems.push(`Project ${project.projectId} isn't in the profile`);
      continue;
    }
    const own = new Set(source.bullets.map((b) => b.id));
    for (const line of project.bullets)
      problems.push(...checkLine(line, facts, (id) => own.has(id), source.name));
  }
  for (const skill of tailored.skills) problems.push(...checkSkill(skill, facts));
  problems.push(...checkIds(tailored, profile));
  problems.push(...checkFreeText(tailored, profile, facts));
  problems.push(...checkClients(tailored, clientNames));
  return { ok: problems.length === 0, problems };
}

type Facts = Map<string, string>;

function factIndex(profile: Profile): Facts {
  const facts: Facts = new Map();
  for (const e of profile.experience) for (const b of e.bullets) facts.set(b.id, b.text);
  for (const p of profile.projects) for (const b of p.bullets) facts.set(b.id, b.text);
  for (const s of profile.skills) facts.set(s.id, s.name);
  for (const c of profile.certifications) facts.set(c.id, c.name);
  return facts;
}

function checkLine(
  line: { text: string; cites: string[] },
  facts: Facts,
  belongs: (id: string) => boolean,
  where: string,
): string[] {
  if (line.cites.length === 0) return [`"${clip(line.text)}" (${where}) cites nothing`];
  const problems = line.cites
    .filter((id) => !belongs(id))
    .map((id) => `"${clip(line.text)}" cites ${id}, which isn't a bullet of ${where}`);
  const sources = line.cites.map((id) => facts.get(id) ?? '').join(' ');
  for (const figure of newFigures(line.text, sources)) {
    problems.push(
      `"${clip(line.text)}" has the figure ${figure}, which ${line.cites.join(', ')} doesn't`,
    );
  }
  return problems;
}

function checkSkill(skill: { text: string; cites: string[] }, facts: Facts): string[] {
  const sources = skill.cites
    .map((id) => facts.get(id))
    .filter((s): s is string => s !== undefined);
  if (sources.length === 0) return [`Skill "${skill.text}" cites nothing in the profile`];
  const named = sources.some((source) => contains(source, skill.text));
  return named ? [] : [`Skill "${skill.text}" isn't named in ${skill.cites.join(', ')}`];
}

function checkIds(tailored: Tailored, profile: Profile): string[] {
  const education = new Set(profile.education.map((e) => e.id));
  const certifications = new Set(profile.certifications.map((c) => c.id));
  return [
    ...tailored.educationIds
      .filter((id) => !education.has(id))
      .map((id) => `Education ${id} isn't in the profile`),
    ...tailored.certificationIds
      .filter((id) => !certifications.has(id))
      .map((id) => `Certification ${id} isn't in the profile`),
  ];
}

// Headline and summary can't cite, so their figures must exist somewhere in the profile.
function checkFreeText(tailored: Tailored, profile: Profile, facts: Facts): string[] {
  const everything = [profile.summary, profile.headline ?? '', ...facts.values()].join(' ');
  const years = Number(
    /(\d+)\+?\s*years?/i.exec(`${tailored.headline} ${tailored.summary}`)?.[1] ?? '0',
  );
  const problems = newFigures(`${tailored.headline} ${tailored.summary}`, everything)
    .filter(
      (figure) =>
        !(years > 0 && figure.startsWith(String(years)) && years <= experienceYears(profile)),
    )
    .map((figure) => `Headline/summary has the figure ${figure}, which the profile doesn't`);
  if (years > experienceYears(profile))
    problems.push(
      `Claims ${String(years)} years; the profile shows about ${String(experienceYears(profile))}`,
    );
  return problems;
}

function checkClients(tailored: Tailored, clientNames: readonly string[]): string[] {
  const all = JSON.stringify(tailored);
  return clientNames
    .filter((name) => name.trim() !== '' && contains(all, name))
    .map((name) => `Names the client "${name}" (D17: describe the client by type)`);
}

export function experienceYears(profile: Profile, now = new Date()): number {
  const months = profile.experience.map((e) => {
    const end = e.end === 'present' ? now : new Date(`${e.end}-01T00:00:00Z`);
    return (
      (end.getTime() - new Date(`${e.start}-01T00:00:00Z`).getTime()) / (30.44 * 24 * 3600 * 1000)
    );
  });
  // Overlapping roles would double-count, so take the span from first start to last end.
  const starts = profile.experience.map((e) => Date.parse(`${e.start}-01T00:00:00Z`));
  if (starts.length === 0) return 0;
  const span = (now.getTime() - Math.min(...starts)) / (365.25 * 24 * 3600 * 1000);
  return Math.floor(Math.min(span, months.reduce((a, b) => a + b, 0) / 12));
}

function newFigures(text: string, sources: string): string[] {
  const known = new Set([...sources.matchAll(NUMBER)].map((m) => normalise(m[0])));
  return [...text.matchAll(NUMBER)]
    .map((m) => m[0].trim())
    .filter((figure) => !known.has(normalise(figure)));
}

function normalise(figure: string): string {
  return figure.replace(/[\s,+]/g, '').toLowerCase();
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase().trim());
}

function clip(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
