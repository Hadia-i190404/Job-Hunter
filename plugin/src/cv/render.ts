// Profile → ATS-safe HTML (spec R5): one column, standard headings, real text, no tables
// or images, system fonts. Chrome prints it to PDF (scripts/cv.ts). No photo, CNIC,
// father's name, date of birth or marital status: the profile has no place for them (D8).
import type { Profile } from '../schema/profile.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderCvHtml(profile: Profile, style: string): string {
  const sections = [
    section('Summary', profile.summary === '' ? '' : `<p>${esc(profile.summary)}</p>`),
    section('Experience', profile.experience.map(experienceItem).join('')),
    section('Projects', profile.projects.map(projectItem).join('')),
    section('Education', profile.education.map(educationItem).join('')),
    section(
      'Skills',
      profile.skills.length === 0
        ? ''
        : `<p>${profile.skills.map((s) => esc(s.name)).join(' · ')}</p>`,
    ),
    section(
      'Certifications',
      list(
        profile.certifications.map((c) =>
          [c.name, c.issuer, c.year?.toString()].filter(Boolean).join(', '),
        ),
      ),
    ),
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

function contactLine(profile: Profile): string {
  const { email, phone, city, links } = profile.contact;
  return [city, phone, email, ...links]
    .filter((part): part is string => Boolean(part))
    .map(esc)
    .join(' | ');
}

function experienceItem(item: Profile['experience'][number]): string {
  const where = [item.company, item.location].filter(Boolean).join(', ');
  return `<div class="item">
<h3>${esc(item.title)} <span class="org">— ${esc(where)}</span></h3>
<p class="dates">${dates(item.start, item.end)}</p>
${list(item.bullets.map((b) => b.text))}
</div>`;
}

function projectItem(item: Profile['projects'][number]): string {
  return `<div class="item">
<h3>${esc(item.name)}</h3>
${item.description ? `<p>${esc(item.description)}</p>` : ''}
${list(item.bullets.map((b) => b.text))}
</div>`;
}

function educationItem(item: Profile['education'][number]): string {
  const when =
    item.start !== undefined || item.end !== undefined ? dates(item.start, item.end) : '';
  return `<div class="item">
<h3>${esc(item.degree)} <span class="org">— ${esc(item.institution)}</span></h3>
${when ? `<p class="dates">${when}</p>` : ''}
${item.details ? `<p>${esc(item.details)}</p>` : ''}
</div>`;
}

function section(title: string, body: string): string {
  return body.trim() === '' ? '' : `<section><h2>${title}</h2>\n${body}\n</section>`;
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
