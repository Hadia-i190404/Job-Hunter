---
description: Write a CV tailored to one job from the user's master profile, following ATS rules, then prove every line is true and print it. Use after a hunt for each top job, or when the user asks to tailor their CV for a job.
allowed-tools: Read, Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/tailor.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts list *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts gap *)
---

# Job Hunter: tailor a CV to one job

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/tailor.ts"
$RUN context <jobId>          # job, why it matched, the search, the profile
$RUN render <tailored.json>   # honesty check → PDF → pages and keyword coverage
```

## Write the tailored CV

Run `context`, read the job description closely, then write
`~/JobHunter/cv/tailored/draft-<jobId-with-dashes>.json`:

```json
{
  "jobId": "greenhouse:canonical-5150422",
  "headline": "Full Stack Software Engineer | React, Next.js, Node.js, PostgreSQL",
  "summary": "At most 3 sentences: role + years + core stack + the 1–2 strongest results.",
  "skills": [{ "text": "React", "cites": ["skill-4"], "group": "Frontend" }],
  "experience": [{ "roleId": "exp-1", "bullets": [{ "text": "…", "cites": ["exp-1-b3"] }] }],
  "projects": [],
  "educationIds": ["edu-1"],
  "educationDetails": false,
  "certificationIds": ["cert-1"],
  "languages": false
}
```

The renderer fixes the **layout** (spec R5, D23): Summary → Technical Skills (grouped)
→ Experience (roles at one company combined under one heading) → Projects →
Education & Certifications → Languages. Links are clickable. Grades only show with
`educationDetails: true`, so use that only when the job or form asks for grades.

### Content rules (R5, D17, D18, D23)

**1. Aim at the job.**

- The headline names the job's role family only if the bullets you chose back it up.
  Example: no "Web Frontend Engineer" headline over mostly Flutter and backend bullets.
  Pick the closest family the evidence supports (Full Stack, Frontend, Backend, AI
  Application, Flutter, Product Engineer).
- The first summary sentence and the **first 3 achievements** must match the vacancy.
- Use the job's exact words where the profile backs them, inside the bullets that show
  the work, not only in the skills list.

**2. Choose and order bullets.**

- Most distinctive work first. Routine tasks never sit above signature achievements.
- Limits (the quality check enforces these): most recent role **≤ 5**; the earlier role
  at the same company **≤ 3**; other roles **≤ 2**; the oldest roles one line.
- Each line cites **only bullets of its own role**.

**3. Write each bullet as action + technical detail + outcome.**

- What you built or improved, how you did it, and what changed. The outcome is a real
  figure, or scale, reliability, security or adoption.
- Example: "Delivered document Q&A across ~34,000 SharePoint files with organisation-scoped
  retrieval, confidential-folder exclusions and source citations."

**4. Be precise about ownership.** Say what was owned (a product, module or workstream)
when the profile says so. Keep your own work separate from the team's.

**5. Use metrics carefully.**

- **≤ 1 percentage per bullet** and **≤ 5 per CV** (enforced).
- Prefer the figures the profile can explain. If a figure's context is thin, use the
  specific engineering outcome instead.
- Never invent, raise or round up a figure.

**6. Keep tools and projects relevant.**

- A tool appears only where it fits the role. For example, Fastlane on a web CV only
  with "mobile releases" said.
- Projects only when they show something the professional experience doesn't. Drop
  student MVPs for experienced roles unless the job calls for that stack.

**7. Skills:** **8–25**, grouped (Frontend, Backend, Databases, Integrations & Tools,
Mobile…), the job's required ones first. Each skill cites the profile skill or the
bullet that names it.

**8. Facts stay fixed.** No new facts, tools, figures, titles or client names (D17).

### When the profile is too vague

Don't guess and don't stall. Record a one-time question for the user's daily list with
`setup.ts gap "<question>" pending`, then write the bullet with what the profile does
say. Typical questions:

- "What exactly did 'sole full-stack engineer' cover: a product, a module, or the whole
  workstream?"
- "For the AI assistant, which parts did you build yourself, and which did the AI team
  build?"
- "How was the '40% API latency' figure measured (endpoint, before/after)?"

## Check, print, then the recruiter pass

Run `render`:

- `error: honesty`: fix every listed problem (usually remove the line or cite the right
  bullet) and run it again. **Never** work around the check.
- `error: quality`: fix the listed recruiter-rule problems (summary length, bullet
  limits, percentages, skill count) and run it again.
- `tooLong: true`: the CV is over `targetPages` (1 page at ≤ 3 years' professional
  experience). Cut the weakest bullets, projects and skills. Don't shrink fonts. Run
  it again.
- `coverage.missingButTrue`: the job asks for these and the profile has them. Work them
  in where true, then render again.
- `coverage.gaps`: saved as questions for the daily list. **Don't** add them.
- Also read the job's requirements yourself, and record each one the profile doesn't
  show with `setup.ts gap "<area>" pending`.

**Recruiter pass.** Read the PDF back with Read and check all of these. Fix and
re-render until they hold:

1. In seconds it's clear **what kind of engineer** this is, **what hard problems** they
   solved, and **what results** they delivered.
2. The headline, first summary sentence and first 3 achievements match this vacancy.
3. Single column, standard headings, contact details in the body, links working, no
   icons, tables or images.
4. Job titles and dates read cleanly. Roles at one company sit under one heading.
5. No near-empty last page, and nothing split awkwardly across pages.
6. Every term from the job that appears is backed by a bullet. Nothing is stuffed in.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here (e.g. "your first 5
applications will come one by one" is not a thing Job Hunter does). If the user asks
about something that isn't here, say it isn't built yet.
