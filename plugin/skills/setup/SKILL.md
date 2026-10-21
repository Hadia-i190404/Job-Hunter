---
description: Job Hunter's one-time setup interview. Collects everything once (CV and profile check, target roles, answers employers keep asking, gaps) so the daily hunt can run quietly. Use when the user says "set up job hunter", runs it for the first time, or wants to change what they're looking for.
allowed-tools: Read, Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/cv.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts *)
---

# Job Hunter: setup interview

This is the **one** time Job Hunter asks the user for things (D20). Collect everything
the daily loop will need, so it can run without interrupting them. Be warm and brisk:
**group questions into a few messages**, offer sensible defaults, and never ask for
something already saved.

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts"
$RUN/store.ts status | init
$RUN/setup.ts show | save-searches <f> | confirm | save-answers <f> | to-drafts <why> <ids…>
             | add-drafts <f> | approve <ids…> | drop <ids…> | gap <area> <added|none|pending> [ids…]
```

Write JSON inputs with Write under `~/JobHunter/` (e.g. `~/JobHunter/setup-searches.json`).
Exit code 3 = Node.js too old (tell them to install the LTS from nodejs.org).

## 0. Start

Run `store.ts status`. Not set up → `store.ts init`. Paused → say so and ask if they want
to resume first. Then `setup.ts show` and **skip every step whose data already exists**
unless the user asked to change it. Tell the user up front: "About 15–20 minutes, once."

## 1. Profile (only facts they stand behind)

- No profile → follow the `/job-hunter:cv` skill's steps 2–7 to import their CV.
- Show the profile compactly: each role (title, company, dates) with its bullets, and the
  skills list. Ask: **"Is everything here true and yours to claim? Tell me anything to
  remove or that's overstated."**
- Anything they don't stand behind → `setup.ts to-drafts "<their reason>" <ids…>`.
  Never edit facts silently; drafts keep the text in case they want it back.
- Things they mention that aren't in the profile → draft them (see step 4) and approve.

## 2. What they're looking for (searches)

One search per distinct target (e.g. "Frontend, remote" and "Full-stack, Islamabad hybrid").
For each, collect:

| Field                      | Ask / default                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `titles`                   | Their words. Suggest close synonyms ("React Developer" for "Frontend Engineer") and keep only those they accept. **Never add roles they didn't choose** |
| `seniority`                | intern / junior / mid / senior / lead, from their experience                                                                                            |
| `experienceYears`          | `{min, max}` of jobs to consider                                                                                                                        |
| `mustSkills`, `niceSkills` | From their profile; they confirm                                                                                                                        |
| `workModes`                | onsite / hybrid / remote                                                                                                                                |
| `cities`                   | Pakistani city ids for on-site/hybrid (`islamabad`, `rawalpindi`, `lahore`, `karachi`, …); `[]` = any                                                   |
| `employment`               | full-time / part-time / contract / internship                                                                                                           |
| `salaryFloor`              | Monthly `{amount, currency: PKR or USD}`, or leave out                                                                                                  |
| `nightShiftOk`             | US hours OK?                                                                                                                                            |
| `skipCompanies`            | Including their current employer                                                                                                                        |
| `mode`                     | `review` (prepare applications) or `shortlist` (just list jobs)                                                                                         |

Ids like `search-1`. Save with `setup.ts save-searches`.

## 3. Answers employers keep asking (answer bank)

Ask these **in one or two grouped messages**, prefilling what the profile already says
(they just confirm). Save with `setup.ts save-answers` as `{key, question, answer, kind}`.

- **fact:** `notice-period`, `earliest-start`, `degree-result` (+ `grading-system`),
  `companies-since-graduation`, `years-experience`, `current-country` (Pakistan),
  `linkedin-url`, `github-url`, `portfolio-url`, `has-passport`
- **preference:** `expected-salary-pkr-month`, `expected-salary-usd-month`,
  `open-to-relocation`, `willing-to-travel-internationally`, `how-did-you-hear` (default
  "Job board")
- **fact (academic, some employers ask):** `hs-math-rank`, `hs-language-rank`,
  `hs-evidence` (e.g. Matric/FSc/O/A-level results)
- **legal:** `work-authorization` (where they may work without sponsorship),
  `needs-sponsorship`
- **demographic (optional, never assumed):** `gender`, `nationality`, `ethnicity`,
  `disability`. Offer "Prefer not to say" as the default and say they can skip.

Never guess any of these. Anything they skip stays unanswered and becomes a question in
the daily list only if an application really needs it.

## 4. Gaps (D16, R5b)

For each search, compare its titles and must-skills with the profile. For each missing
area (e.g. "client-facing work" for a forward deployed role):

1. Ask once, with 3–5 concrete prompts ("Have you joined client calls? Demoed to a
   client? Deployed at a client's site?").
2. Draft entries **from their words only**: may be made professional, never bigger (no
   numbers, titles, tools, clients or frequency they didn't state). Place each under the
   right role (`experience-bullet` + `parentId`) or as a `skill`. Ids like `user-1`.
3. `setup.ts add-drafts <f>`, show the drafts, then `approve` / `drop` per their answer.
4. Record it: `setup.ts gap "<area>" added <ids…>` or `gap "<area>" none`.

A "no" is fine: record `none` and move on.

## 5. Read-back and confirm

Summarise in a short block: who they are (one line), each search, how many answers are
saved, what's still unanswered, gaps added. Ask: **"Shall I start hunting with this?"**
Yes → `setup.ts confirm`. Edits → fix, save, read back again.

## 6. What happens next

Say exactly this, nothing more: "You're set up. Run `/job-hunter:hunt` to find, rank and
prepare applications, then `/job-hunter:review` to answer what's left, approve the batch
and submit. (The automatic 09:00 daily run isn't built yet.)"

## Rules

- One interview. Group questions; don't drip them one at a time.
- Nothing goes into the profile without their approval; drafts wait in drafts.
- Never invent target roles, skills, experience or answers.
- Don't repeat CNIC, phone or address back in chat.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here (e.g. "your first 5
applications will come one by one" is not a thing Job Hunter does). If the user asks
about something that isn't here, say it isn't built yet.
