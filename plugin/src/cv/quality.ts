// The recruiter rules a tailored CV must meet before it prints (spec R5, D23). The
// honesty check proves every line is true; this proves the CV is shaped the way a
// recruiter reads it.
import type { Profile } from '../schema/profile.ts';
import type { Tailored } from '../schema/tailored.ts';

export interface QualityReport {
  ok: boolean;
  problems: string[];
}

const MAX_SUMMARY_SENTENCES = 3;
const MAX_SUMMARY_CHARS = 480;
const MAX_PERCENT_PER_CV = 5;
const SKILLS = { min: 8, max: 25 };
const PERCENT = /\d+(?:\.\d+)?\s*%/g;

export function checkQuality(tailored: Tailored, profile: Profile): QualityReport {
  const problems = [
    ...summaryProblems(tailored.summary),
    ...bulletLimitProblems(tailored, profile),
    ...percentProblems(tailored),
    ...skillProblems(tailored, Math.min(SKILLS.min, profile.skills.length)),
  ];
  return { ok: problems.length === 0, problems };
}

function summaryProblems(summary: string): string[] {
  const sentences = summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== '').length;
  const problems: string[] = [];
  if (sentences > MAX_SUMMARY_SENTENCES) {
    problems.push(
      `Summary has ${String(sentences)} sentences; keep it to ${String(MAX_SUMMARY_SENTENCES)}`,
    );
  }
  if (summary.length > MAX_SUMMARY_CHARS) {
    problems.push(
      `Summary is ${String(summary.length)} characters; keep it under ${String(MAX_SUMMARY_CHARS)}`,
    );
  }
  return problems;
}

// Most recent role up to 5 bullets, the earlier role at the same company up to 3, other
// roles up to 2 (D23). Roles count in the order the CV shows them.
function bulletLimitProblems(tailored: Tailored, profile: Profile): string[] {
  const companyOf = new Map(profile.experience.map((e) => [e.id, e.company.toLowerCase()]));
  const titleOf = new Map(profile.experience.map((e) => [e.id, e.title]));
  const firstCompany = companyOf.get(tailored.experience[0]?.roleId ?? '');
  return tailored.experience.flatMap((role, index) => {
    const limit = index === 0 ? 5 : companyOf.get(role.roleId) === firstCompany ? 3 : 2;
    return role.bullets.length > limit
      ? [
          `${titleOf.get(role.roleId) ?? role.roleId} has ${String(role.bullets.length)} bullets; the limit for this role is ${String(limit)}`,
        ]
      : [];
  });
}

function percentProblems(tailored: Tailored): string[] {
  const bullets = [...tailored.experience, ...tailored.projects].flatMap((r) => r.bullets);
  const problems = bullets
    .filter((b) => (b.text.match(PERCENT) ?? []).length > 1)
    .map((b) => `"${clip(b.text)}" has more than one percentage; keep the strongest`);
  const total =
    [tailored.summary, ...bullets.map((b) => b.text)].join(' ').match(PERCENT)?.length ?? 0;
  if (total > MAX_PERCENT_PER_CV) {
    problems.push(
      `${String(total)} percentages in the CV; keep at most ${String(MAX_PERCENT_PER_CV)} you can explain`,
    );
  }
  return problems;
}

// A small profile can't reach 8 skills; then all of them is the minimum.
function skillProblems(tailored: Tailored, min: number): string[] {
  const count = tailored.skills.length;
  if (count < min || count > SKILLS.max) {
    return [
      `${String(count)} skills; use ${String(min)}–${String(SKILLS.max)}, the job's required ones first`,
    ];
  }
  return [];
}

// 1 page for up to 3 years' professional experience, otherwise 2 (D23). Internships,
// teaching-assistant and trainee roles don't count towards it, as recruiters see it.
const NOT_PROFESSIONAL = /\b(intern(ship)?|trainee|teaching assistant|student|apprentice)\b/i;

export function professionalYears(profile: Profile, now = new Date()): number {
  const starts = profile.experience
    .filter((e) => !NOT_PROFESSIONAL.test(e.title))
    .map((e) => Date.parse(`${e.start}-01T00:00:00Z`));
  if (starts.length === 0) return 0;
  return Math.floor((now.getTime() - Math.min(...starts)) / (365.25 * 24 * 3600 * 1000));
}

export function pageTarget(years: number): number {
  return years <= 3 ? 1 : 2;
}

function clip(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
