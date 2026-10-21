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
  "headline": "Frontend Engineer | React, TypeScript, Flutter",
  "summary": "3–4 lines aimed at this job, in its words, backed by the profile.",
  "experience": [{ "roleId": "exp-1", "bullets": [{ "text": "…", "cites": ["exp-1-b3"] }] }],
  "projects": [{ "projectId": "proj-1", "bullets": [{ "text": "…", "cites": ["proj-1-b1"] }] }],
  "skills": [{ "text": "React", "cites": ["skill-4"] }],
  "educationIds": ["edu-1"],
  "certificationIds": [],
  "languages": false
}
```

**ATS and recruiter rules (spec R5, D17, D18):**

- Use the job's **exact words** for skills, tools and duties wherever the profile backs
  them. ATS filters match literally.
- Headline and summary aimed at this role. Use only figures that are in the profile.
- Most relevant bullets first in each role: **3–6** for recent roles, **1–3** for older
  ones. Cut weak ones rather than blurring them.
- Write each bullet as "did X, using Y, achieving Z". Keep the profile's real figures
  exactly. Never invent, raise or round up a figure.
- **12–25 skills**, the job's required ones first. Each cites the profile skill (or the
  bullet) that names it.
- Aim for **1 page** for 3 years or less of experience, 2 at most.
- Each line may cite **only bullets of its own role**. Rewording is fine; new facts,
  tools, figures, titles or clients are not.
- No client names (D17): describe the client by type.

## Check and print

Run `render`:

- `error: honesty`: fix every listed problem (usually remove the line or cite the right
  bullet) and run it again. **Never** work around the check.
- `tooLong: true`: cut the weakest bullets and skills, then render again.
- `coverage.missingButTrue`: the job asks for these and the profile has them. Work them
  in where true, then render again.
- `coverage.gaps`: the job asks for these and the profile doesn't have them. They are
  saved as questions for the user's daily list. **Don't** add them.
- The automatic list only knows terms from the profile and searches. Also read the
  job's requirements yourself, and record each one the profile doesn't show (a tool, a
  domain, client-facing work…) as a question for the daily list:
  `setup.ts gap "<area>" pending`. Don't ask the user now (D20).

Finally **read the PDF back** with Read: the name, each role's title, company and dates,
and every bullet must come through cleanly.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here (e.g. "your first 5
applications will come one by one" is not a thing Job Hunter does). If the user asks
about something that isn't here, say it isn't built yet.
