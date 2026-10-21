# Job Hunter

**Your job search, done for you, without risking your accounts.**

Job Hunter is an add-on (a plugin) for the Claude desktop app. It's built for job
seekers in **Pakistan**. You tell it what you're looking for and give it your CV. Every
day it:

- searches the job sites;
- throws out jobs you can't actually take;
- tailors your CV for the good ones;
- prepares each application and each message to the hiring team.

You stay in control of everything that goes out in your name.

> **Status: in development (phase P0).** This README describes the planned product.
> The checklist under [Status](#status) shows what works today.

---

## Contents

- [Why Job Hunter](#why-job-hunter)
- [What it looks for](#what-it-looks-for)
- [How it works](#how-it-works)
- [What it will and won't do for you](#what-it-will-and-wont-do-for-you)
- [What you need](#what-you-need)
- [Install](#install)
- [Getting updates](#getting-updates)
- [Daily use](#daily-use)
- [Commands](#commands)
- [Job sites covered](#job-sites-covered)
- [Your data and privacy](#your-data-and-privacy)
- [Usage settings (Pro vs Max)](#usage-settings-pro-vs-max)
- [FAQ](#faq)
- [For developers](#for-developers)
- [Status](#status)

---

## Why Job Hunter

Job hunting from Pakistan usually means:

- checking a dozen or more sites every day and retyping the same CV into each;
- applying to "remote" jobs that quietly reject Pakistan because of location, working
  hours or payroll;
- a LinkedIn profile that recruiters never find;
- auto-apply bots that spray applications everywhere and get LinkedIn accounts banned.

Job Hunter knows which jobs a person in Pakistan can really get. It does the repetitive
work and **never touches your logged-in accounts**.

## What it looks for

| Track                   | Example                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **On-site in Pakistan** | Accountant, Karachi                                                                                                                   |
| **Hybrid in Pakistan**  | Product designer, Lahore, 3 days in office                                                                                            |
| **Remote, any country** | "Remote: worldwide", "Remote: EMEA", "Remote (Asia)", as long as the employer can hire someone in Pakistan and the hours work for you |

Every job gets a verdict with a reason:

- ✅ **Eligible**: "Remote worldwide, pays contractors, 4 hours overlap with PKT"
- 🟡 **Likely** / ❔ **Unclear**: "Says EMEA; Pakistan not mentioned either way"
- ⛔ **Not eligible**: "Remote, but 'must live in the US'"

Jobs that look like scams (asking you for fees, WhatsApp-only "recruiters", pay that's
too good to be true) are hidden, and the reason is shown.

## How it works

```
 Your CV + what you want
          │
          ▼
 ┌──────────────────┐   You check the read-back and confirm.
 │ 1. Set up        │   Nothing goes out before you confirm.
 └──────────────────┘
          │
          ▼  every day at 9:00 PKT
 ┌──────────────────┐   Searches every job site, removes duplicates,
 │ 2. Hunt          │   judges eligibility, filters scams, scores matches.
 └──────────────────┘
          │
          ▼  desktop notification: "7 new matches, 3 things waiting for you"
 ┌──────────────────┐   You pick jobs. For each one it tailors your CV
 │ 3. Prepare       │   (truthfully), prepares the application and a short
 └──────────────────┘   message to the hiring team.
          │
          ▼
 ┌──────────────────┐   Career-site form: it fills, you press Submit.
 │ 4. You send      │   LinkedIn and other logged-in sites: you get an action
 └──────────────────┘   card (link + text to copy + CV file), and you do it.
          │
          ▼
 ┌──────────────────┐   Pipeline: Found → Applied → Messaged → Replied →
 │ 5. Track         │   Interview → Offer. One follow-up reminder, at most.
 └──────────────────┘
```

### The three action levels

| Level                                 | Who does it                                                                        | Where                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A: Job Hunter does it**             | Job Hunter, fully                                                                  | Searching public listings, reading job pages, writing CVs and messages       |
| **B: Job Hunter fills, you submit**   | Job Hunter fills the form in the app's browser. **You check it and press Submit.** | Company career sites with no login (Greenhouse, Lever, Ashby, Workable, …)   |
| **C: Job Hunter prepares, you do it** | You, using an **action card**                                                      | LinkedIn (always), Indeed, Rozee, Glassdoor and any site you're logged in to |

An **action card** has:

- one line saying what to do;
- a link to the exact page;
- each piece of text with a **Copy** button, in the order the site asks for it;
- the right CV file;
- answers to the screening questions you can expect;
- **Done**, **Skip** and **Snooze** buttons.

It turns a 15-minute task into about a minute, and your account only ever sees you.

## What it will and won't do for you

**It will:**

- rewrite your LinkedIn headline, About section, experience and skills so recruiters
  find you (shown as before/after for you to approve);
- tailor your CV for each job: an ATS-friendly layout, the job's own wording, the
  relevant skills first;
- tell you about gaps ("this job asks for X; your CV doesn't mention it");
- find who's hiring and draft a short, specific message;
- remember your answers to screening questions (notice period, expected salary, …)
  so it only asks once.

**It won't, ever:**

- add anything to your CV that isn't true;
- click, type or send anything on LinkedIn or any site you're logged in to;
- press Submit on an application for you;
- answer work-permission, visa, legal or demographic questions without asking you;
- ask for, store or type your passwords, or solve CAPTCHAs;
- send more than one follow-up to anyone.

## What you need

|                        |                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude plan**        | **Pro or higher**, on _your own_ account. The Free plan doesn't include Claude Code, and accounts can't be shared (Anthropic's terms). |
| **Claude desktop app** | Latest version, on macOS or Windows                                                                                                    |
| **Node.js**            | 22.18 or newer ([download](https://nodejs.org/), pick "LTS")                                                                           |
| **Google Chrome**      | Used to make PDF CVs                                                                                                                   |
| **Your CV**            | PDF or Word                                                                                                                            |

Nothing else. No servers, no subscriptions, no API keys.

## Install

1. Open **Terminal** (any folder) and run these two commands:
   ```bash
   claude plugin marketplace add Hadia-i190404/Job-Hunter
   ```
   ```bash
   claude plugin install job-hunter@job-hunter
   ```
   (`claude` comes with Claude Code. If Terminal says "command not found", install
   Claude Code first: <https://claude.com/claude-code>.)
2. Open the Claude desktop app, go to the **Code** tab and start a **new session**.
   Plugins only load in new sessions.
3. Run `/job-hunter:status` to check it's installed.
4. Run `/job-hunter:setup`. It checks Node.js, creates your data folder, reads your CV,
   asks what you're looking for, and shows you a read-back to confirm.
5. Say yes when it offers to create the **daily 9:00 run**.

Installing downloads only the plugin's own files (a few hundred KB). Job Hunter has no
other dependencies.

## Getting updates

When the owner says there's an update, run these in Terminal, then start a new session:

```bash
claude plugin marketplace update job-hunter
```

```bash
claude plugin update job-hunter@job-hunter
```

Updates never touch your data. _(Automatic updates are being tested; this section will
change once they're confirmed.)_

## Daily use

- **Morning:** you get a notification like "7 new matches, 3 things waiting for you".
- **Review:** say _"show me today's matches"_, or open the dashboard
  (`/job-hunter:status` → _"open the dashboard"_).
- **Pick jobs:** 👍 / 👎 teaches it your taste. _"Prepare this one"_ makes the tailored CV,
  the application and the message.
- **Send:** for a career-site form, check what it filled and press Submit. For an action
  card, follow it and press **Done**.
- **Replies:** when someone replies or invites you to interview, tell it (_"Acme replied"_)
  or move the card on the dashboard.
- **Pause:** _"pause job hunter"_ stops the daily run and any form filling straight away.

The daily run only happens while your computer is on and the Claude app is open. If you
miss a day, it catches up the next time you open the app.

## Commands

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `/job-hunter:setup`    | First-time setup, or change your CV / what you're looking for      |
| `/job-hunter:hunt`     | Run a search now (the daily run uses this too)                     |
| `/job-hunter:review`   | Go through new matches in chat                                     |
| `/job-hunter:tailor`   | Tailored CV (and cover letter) for one job                         |
| `/job-hunter:apply`    | Fill a career-site form (level B) or make an action card (level C) |
| `/job-hunter:linkedin` | LinkedIn profile rewrite, as before/after cards                    |
| `/job-hunter:outreach` | Find the hiring team, draft messages, follow-up reminders          |
| `/job-hunter:add-site` | Add a job site it doesn't search yet, by pasting a URL             |
| `/job-hunter:status`   | What's waiting for you, the pipeline, the dashboard, pause/resume  |

You can also just talk to it in plain English. The commands are shortcuts.

## Job sites covered

| Site                                                                                   | How it searches                                                   | How you apply                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| Remotive, Remote OK, Himalayas, Jobicy, Working Nomads                                 | Official public feed                                              | On the employer's site       |
| We Work Remotely                                                                       | RSS feed                                                          | On the employer's site       |
| Company career sites on Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee | Public job-board feeds                                            | **B**: it fills, you submit  |
| BambooHR, Workday career sites                                                         | Public pages                                                      | B, or C if a login is needed |
| Rozee.pk, Bayt, GulfTalent, NaukriGulf                                                 | Public listings (Gulf sites: Pakistan-based and remote jobs only) | **C**: action card           |
| LinkedIn Jobs                                                                          | Public, logged-out listings only                                  | **C**: always                |
| Indeed, Glassdoor                                                                      | Public pages, or web search if they block it                      | C                            |
| Wellfound, Arc.dev, Turing                                                             | Public pages                                                      | C                            |
| **Any site you add**                                                                   | `/job-hunter:add-site <url>`                                      | B or C                       |

Some big sites block automated reading even when you're logged out. When that happens,
Job Hunter finds their listings through web search, or you paste links from your
job-alert emails. The dashboard shows how each site is working: **working**,
**fallback** or **broken**.

## Your data and privacy

- **Everything about you stays on your computer**, in `~/JobHunter/`: your profile,
  CVs, answers, matches and log. It's never uploaded to GitHub or any server.
- The folder and its files can only be opened by you. To keep it somewhere else, set
  `JOB_HUNTER_HOME` to that path.
- If a file gets damaged (for example by a crash), Job Hunter restores the last good copy
  and keeps the damaged one beside it as `<name>.corrupt-<time>`.
- Back it up by copying the folder. Delete the folder and everything about you is gone.
- **Shared with the group** (in the repo's `plugin/shared/` folder): only job sites someone
  added, notes on which employers hire from Pakistan, and scam reports. Never CVs,
  profiles or answers.
- Your Claude conversations are covered by your own Claude account's privacy settings.

| File in `~/JobHunter/`            | Holds                                                         |
| --------------------------------- | ------------------------------------------------------------- |
| `profile.json`                    | Your master profile, the only source of facts it uses         |
| `searches.json`                   | What you're looking for                                       |
| `answers.json`                    | Your saved screening-question answers                         |
| `jobs.jsonl`, `assessments.jsonl` | Jobs found, and how each was judged                           |
| `pipeline.json`, `cards.json`     | Where each application is; action cards                       |
| `cv/`                             | Tailored CVs (PDF and Word) and what changed in each          |
| `log.jsonl`                       | Everything Job Hunter did, and everything you marked done     |
| `settings.json`                   | Paused, sites on/off, usage setting                           |
| `meta.json`                       | Data-folder version, so updates can upgrade your files safely |

## Usage settings (Pro vs Max)

Job Hunter does the heavy lifting with free local scripts and uses Claude only for
judgement calls, so it fits on a **Pro** plan.

| Setting                         | Jobs judged by Claude per daily run | Prepares applications      |
| ------------------------------- | ----------------------------------- | -------------------------- |
| `light` (default, good for Pro) | about 25                            | when you ask               |
| `full` (for Max)                | about 60                            | top matches, automatically |

Change it with _"switch job hunter to full usage"_. If a run hits your plan's limit, it
finishes what it can and continues on the next run.

## FAQ

**Will my LinkedIn get banned?**
Job Hunter never logs in to LinkedIn, never clicks there and never sends anything. You
do every LinkedIn action yourself from an action card, so your account only ever sees
you.

**Can my friend use my Claude plan?**
No. Anthropic's terms don't allow sharing an account. Each person needs their own Pro
(or higher) plan. The plugin itself is free, and updates reach everyone.

**Will it make my CV sound better than I am?**
No. Every line in a tailored CV has to trace back to your own profile, and a separate
check removes anything that doesn't. If a job needs something you don't have, it tells
you instead of adding it.

**What about the photo, CNIC, father's name and date of birth on my CV?**
They're left off every CV it makes. Modern CVs, in Pakistan too, don't need them.

**Does it apply to jobs abroad that need relocation?**
Not in this version. It covers on-site and hybrid jobs in Pakistan, and remote jobs from
anywhere.

**It missed a job site I use.**
`/job-hunter:add-site` and paste the site's search page. If it can read the jobs there,
it'll search it every day from then on.

---

## For developers

Read **[CLAUDE.md](CLAUDE.md)** first. It's the guide for anyone (human or agent)
changing the code, including the hard safety rules.

### Spec-driven workflow

Every change goes **spec → plan → tasks → code**, and the owner reviews each step.

| Doc                                                                |                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| [`specs/0001-job-hunter/spec.md`](specs/0001-job-hunter/spec.md)   | What and why; decisions D1–D13; acceptance criteria |
| [`specs/0001-job-hunter/plan.md`](specs/0001-job-hunter/plan.md)   | Architecture, data folder, connectors, phases       |
| [`specs/0001-job-hunter/tasks.md`](specs/0001-job-hunter/tasks.md) | Ordered tasks, each with "Done when"                |

### Setup

```bash
git clone https://github.com/Hadia-i190404/Job-Hunter.git
cd Job-Hunter
npm install          # also installs the pre-commit hook
npm run check
```

### Checks

| Check     | Command                | Enforces                                                                                                                                                     |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types     | `npm run typecheck`    | Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …)                                                                              |
| Lint      | `npm run lint`         | Type-aware typescript-eslint, size/complexity limits, banned imports (browser automation, paid AI SDKs, heavy utility libraries), no packages in plugin code |
| Format    | `npm run format:check` | Prettier                                                                                                                                                     |
| Tests     | `npm run test`         | Vitest, coverage ≥ 80% on `plugin/src/` and `tools/privacy/`                                                                                                 |
| Dead code | `npm run knip`         | No unused files, exports or dependencies                                                                                                                     |
| Privacy   | `npm run privacy`      | No emails, phone numbers, CNICs, home paths, CVs or data files in the repo                                                                                   |
| **All**   | `npm run check`        | Everything above. CI runs this on every push and PR                                                                                                          |

The **pre-commit hook** runs the privacy guard on staged files, then typecheck, lint,
format and tests. A failing check blocks the commit.

### Layout

```
.claude-plugin/   marketplace manifest → ./plugin
plugin/           the plugin itself: the only folder users install
  skills/         one folder per slash command (SKILL.md)
  src/            schema/, store/, connectors/, pipeline/, cv/, dashboard/
  scripts/        command-line entry points the skills run
  templates/      ATS-safe CV and cover-letter templates
  shared/         group-shared data (no personal data)
tools/            dev-only tools (privacy guard)
tests/            mirrors plugin/src and tools; fixtures/ = fake or scrubbed data only
specs/            spec → plan → tasks
```

The plugin has **no dependencies**: it runs on Node's built-in TypeScript support, and
lint stops plugin code from importing packages. Dev tools live at the repo root and are
never shipped.

## Status

Phase **P0 (spike)**. See [tasks.md](specs/0001-job-hunter/tasks.md).

- [x] Spec, plan and task list agreed
- [x] Repo foundation: checks, privacy guard, pre-commit hook, CI
- [x] Plugin skeleton installable from GitHub (`/job-hunter:status`)
- [x] Plugin ships with zero dependencies
- [x] Data folder and store (safe writes, recovery, upgrades, pause/resume)
- [x] One job format: cities, work mode, salary in PKR and USD per month
- [ ] First three job sources (Remotive, Greenhouse, Rozee.pk)
- [ ] Eligibility and scam rules
- [ ] CV read → tailored PDF/Word round trip
- [ ] Career-site form filling (level B) test
- [ ] Daily run and notification on Pro

## License

Private, personal project. All rights reserved.
