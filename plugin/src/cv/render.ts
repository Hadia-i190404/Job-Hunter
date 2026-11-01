// Profile → ATS-safe HTML (spec R5, D23): one column, standard headings, real text, no
// tables or images, system fonts. Chrome prints it to PDF. Section order puts skills
// right after the summary; roles at one company share a block; links are clickable.
// No photo, CNIC, father's name, date of birth or marital status: the profile has no
// place for them (D8).
import type { Profile } from '../schema/profile.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Role = Profile['experience'][number];

export function renderCvHtml(profile: Profile, style: string): string {
  const sections = [
    section('Summary', profile.summary === '' ? '' : `<p>${esc(profile.summary)}</p>`),
    section('Technical Skills', skillsBlock(profile.skills)),
    section('Experience', companyBlocks(profile.experience).map(companyItem).join('')),
    section('Projects', profile.projects.map(projectItem).join('')),
    section('Education & Certifications', educationBlock(profile)),
    section(
      'Languages',
      list(profile.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name))),
    ),
  ];
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${esc(profile.name)} – CV</title><style>${style}</style></head>
<body>
<header>
<h1>${esc(profile.name)}</h1>
${profile.headline ? `<p class="headline">${esc(profile.headline)}</p>` : ''}
<p class="contact">${contactLine(profile)}</p>
</header>
${sections.join('\n')}
</body>
</html>
`;
}

// Email, phone and links as real links, so recruiters can click them in the PDF.
function contactLine(profile: Profile): string {
  const { email, phone, city, links } = profile.contact;
  const parts = [
    city === undefined ? undefined : esc(city),
    phone === undefined ? undefined : esc(phone),
    email === undefined ? undefined : `<a href="mailto:${esc(email)}">${esc(email)}</a>`,
    ...links.map((link) => `<a href="${esc(toUrl(link))}">${esc(link)}</a>`),
  ];
  return parts.filter((part): part is string => part !== undefined).join(' | ');
}

function toUrl(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

// "Frontend: React, Next.js" lines when skills carry groups, else one line.
function skillsBlock(skills: Profile['skills']): string {
  if (skills.length === 0) return '';
  if (!skills.some((s) => s.group !== undefined)) {
    return `<p>${skills.map((s) => esc(s.name)).join(' · ')}</p>`;
  }
  const groups = new Map<string, string[]>();
  for (const skill of skills) {
    const label = skill.group ?? 'Other';
    groups.set(label, [...(groups.get(label) ?? []), skill.name]);
  }
  return [...groups]
    .map(
      ([label, names]) =>
        `<p class="skills"><strong>${esc(label)}:</strong> ${names.map(esc).join(', ')}</p>`,
    )
    .join('');
}

interface CompanyBlock {
  company: string;
  location?: string;
  roles: Role[];
}

// Consecutive roles at the same company become one block (D23): progression at a glance.
export function companyBlocks(roles: readonly Role[]): CompanyBlock[] {
  const blocks: CompanyBlock[] = [];
  for (const role of roles) {
    const last = blocks.at(-1);
    if (last?.company.toLowerCase() === role.company.toLowerCase()) {
      last.roles.push(role);
    } else {
      blocks.push({
        company: role.company,
        ...(role.location ? { location: role.location } : {}),
        roles: [role],
      });
    }
  }
  return blocks;
}

function companyItem(block: CompanyBlock): string {
  const [first] = block.roles;
  if (block.roles.length === 1 && first !== undefined) return singleRole(first);
  const starts = block.roles.map((r) => r.start).sort();
  const ends = block.roles.map((r) => r.end);
  const end = ends.includes('present') ? 'present' : [...ends].sort().at(-1);
  const where = [block.company, block.location].filter(Boolean).join(', ');
  return `<div class="item">
<div class="item-head company">
<h3>${esc(where)}</h3>
<p class="dates">${dates(starts[0], end)}</p>
</div>
${block.roles
  .map(
    (role) => `<div class="role">
<div class="item-head"><h4>${esc(role.title)} <span class="dates">· ${dates(role.start, role.end)}</span></h4></div>
${list(role.bullets.map((b) => b.text))}
</div>`,
  )
  .join('')}
</div>`;
}

function singleRole(item: Role): string {
  const where = [item.company, item.location].filter(Boolean).join(', ');
  return `<div class="item">
<div class="item-head">
<h3>${esc(item.title)} <span class="org">— ${esc(where)}</span></h3>
<p class="dates">${dates(item.start, item.end)}</p>
</div>
${list(item.bullets.map((b) => b.text))}
</div>`;
}

function projectItem(item: Profile['projects'][number]): string {
  return `<div class="item">
<div class="item-head"><h3>${esc(item.name)}</h3></div>
${item.description ? `<p>${esc(item.description)}</p>` : ''}
${list(item.bullets.map((b) => b.text))}
</div>`;
}

function educationBlock(profile: Profile): string {
  const education = profile.education.map((item) => {
    const year =
      item.end === undefined ? '' : ` · ${formatMonth(item.end).split(' ').at(-1) ?? ''}`;
    const details = item.details ? ` · ${esc(item.details)}` : '';
    return `<p class="edu"><strong>${esc(item.degree)}</strong> · ${esc(item.institution)}${year}${details}</p>`;
  });
  const certifications = profile.certifications.map(
    (c) =>
      `<p class="edu">${esc([c.name, c.issuer, c.year?.toString()].filter(Boolean).join(', '))}</p>`,
  );
  return [...education, ...certifications].join('');
}

function section(title: string, body: string): string {
  return body.trim() === '' ? '' : `<section><h2>${esc(title)}</h2>\n${body}\n</section>`;
}

function list(items: readonly string[]): string {
  return items.length === 0
    ? ''
    : `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function dates(start: string | undefined, end: string | undefined): string {
  return [start, end]
    .filter((d): d is string => d !== undefined)
    .map(formatMonth)
    .join(' – ');
}

export function formatMonth(value: string): string {
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  return `${MONTHS[Number(month) - 1] ?? ''} ${year ?? ''}`.trim();
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
