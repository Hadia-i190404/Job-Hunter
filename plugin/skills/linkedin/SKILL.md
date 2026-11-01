---
description: Rewrite the user's LinkedIn profile so recruiters find them and ATS keyword searches match - headline, About, experience, skills, open-to-work settings - as before/after suggestions the user approves and pastes in themselves. Use when the user asks to improve or update their LinkedIn.
allowed-tools: Read, Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/linkedin.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts show), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts gap *)
---

# Job Hunter: LinkedIn rewrite

**Job Hunter never logs in to, browses, or changes LinkedIn** (D3, R7). The user pastes
every change in themselves.

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts"
$RUN/setup.ts show                    # profile + searches (the facts and the targets)
$RUN/linkedin.ts save <file> | list | mark <section> <approved|done|skipped>
```

## Steps

1. **Current profile:** ask the user for their LinkedIn as a PDF (on LinkedIn: their
   profile → More → Save to PDF) and read it with Read, or for the pasted text of each
   section. This is the "before". Don't open LinkedIn.
2. **Facts and targets:** `setup.ts show`. Every new line must come from the master
   profile (cite the entries). The searches give the roles recruiters should find them
   for.
3. **Write the suggestions** to `~/JobHunter/linkedin-draft.json` as
   `[{section, label, before, after, cites}]`:
   - `headline` (≤ 220 characters): the target role family + 3–4 core skills + one
     proof point. Same rule as CVs: only claim a role the experience backs.
   - `about` (3 short paragraphs): what kind of engineer, the hardest problems solved,
     the results. First person, plain, no buzzwords. Then a line of core skills in the
     target roles' words.
   - `experience:<roleId>` per recent role: 3–5 bullets, action + technical detail +
     outcome (spec R5). Roles at one company can sit under one company entry with each
     title.
   - `skills`: the top skills in order, the targets' required ones first. LinkedIn shows
     the first few most.
   - `open-to`: Open to Work set to **recruiters only**, job titles = the user's search
     titles, locations = their cities plus "Remote", work types from their searches.
   - `custom-url`: suggest `linkedin.com/in/<firstname-lastname>` if theirs isn't clean.
     The rules are the CV's: no client names (D17), at most one percentage per bullet,
     ownership stated precisely, no new facts. Anything too vague to write well becomes a
     one-time question: `setup.ts gap "<question>" pending`.
4. `linkedin.ts save ~/JobHunter/linkedin-draft.json`, then show each section as
   **Before** and **After**. The after text goes in its own fenced code block so it has
   a copy button. Ask the user to approve, edit or skip each section, and mark each one
   with `linkedin.ts mark`.
5. For approved sections, say where to paste each one on LinkedIn (Intro → Headline;
   About; each Experience entry; Skills; Open to work under the profile photo; Edit
   public profile & URL). When the user says a section is in, mark it `done`.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
