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

> **Status: in daily use.** The full loop (setup → daily hunt → tailored CVs → applications
> → tracking) has been running for real since 1 Nov 2026. [Status](#status) lists what's
> built and what's next.

---

## Contents

- [Why Job Hunter](#why-job-hunter)
- [What it looks for](#what-it-looks-for)
- [How it works](#how-it-works)
- [How it's built: the agent design](#how-its-built-the-agent-design)
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
work and **nothing goes out in your name without your OK**.

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

| Level                                 | Who does it                                                                        | Where                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **A: Job Hunter does it**             | Job Hunter, fully                                                                  | Searching public listings, reading job pages, writing CVs and messages     |
| **B: Job Hunter fills, you submit**   | Job Hunter fills the form in the app's browser. **You check it and press Submit.** | Company career sites with no login (Greenhouse, Lever, Ashby, Workable, …) |
| **C: Job Hunter prepares, you do it** | You, using an **action card**                                                      | LinkedIn, Indeed, Rozee, Mustakbil and any site you're logged in to        |

An **action card** has:

- one line saying what to do;
- a link to the exact page;
- each piece of text with a **Copy** button, in the order the site asks for it;
- the right CV file;
- answers to the screening questions you can expect.

It turns a 15-minute task into about a minute, and your account only ever sees you.

## How it's built: the agent design

Job Hunter is an agent built on Claude Code. The split is deliberate: **plain local
scripts do everything that has to be exact and repeatable, and Claude is used only for
judgement.** That keeps runs cheap enough for a Pro plan, and makes behaviour testable.

| Concern                           | How it's handled                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deterministic vs model work**   | TypeScript scripts (zero runtime dependencies) fetch jobs, normalise them, judge Pakistan eligibility with rules, score scams, dedupe and match. Claude only reads the jobs the rules mark _unclear_, tailors CVs and drafts answers.                                                                                  |
| **Human approval as a hard gate** | Every application moves through a status machine (`prepared → needs-you → approved → submitted → replied → interview …`). The script that plans a form fill refuses anything not `approved`. One batch approval a day, not one ping per job.                                                                           |
| **Permissions by site**           | Three action levels (below): public pages it reads itself; no-login career forms it fills and **you** press Submit; logged-in sites only in a session you started and are watching, stopping at any CAPTCHA or warning and handing back to you.                                                                        |
| **Handovers when it needs you**   | Anything only you can answer (work permit, salary, declarations, a missing fact) becomes a to-do on the application instead of a guess. On employer forms that ban AI-written answers, the code refuses free-text answers from Claude.                                                                                 |
| **Honesty checks**                | Every tailored CV line must trace back to your master profile. An honesty check, then a recruiter-rules quality check, run before the PDF is made; a failure blocks the PDF. Unconfirmed claims live in a drafts list until you approve them.                                                                          |
| **Failure handling**              | Network calls time out and return errors instead of throwing, with a polite per-site delay; one broken source doesn't stop the run; daily limits per source. Data files are written atomically with a `.bak` copy, validated against a schema on every read, and upgraded by migrations. Everything it does is logged. |
| **Quality gates**                 | Strict TypeScript, type-aware lint with size/complexity limits, 330 tests with ≥ 80% coverage, a privacy guard that blocks personal data from the repo, and CI on every push.                                                                                                                                          |

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
- act on LinkedIn or any site you're logged in to on its own: only in a session you
  started and are watching, at a normal pace, stopping at any warning (see the FAQ);
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
- **Review:** run `/job-hunter:review` (or say _"what's waiting for me?"_): today's
  prepared applications and the few things only you can answer, with one approval for
  the batch.
- **Send:** for a career-site form, it fills the form and you check it and press Submit.
  For an action card, follow it and say _"done"_.
- **Friends' links:** say _"check my LinkedIn messages"_ and it reads the jobs friends sent
  you (in your own signed-in Chrome, while you watch) and adds them.
- **Replies:** when someone replies or invites you to interview, tell it
  (_"Acme replied"_).
- **Pause:** _"pause job hunter"_ stops the daily run and any form filling straight away.

The daily run only happens while your computer is on and the Claude app is open. If you
miss a day, it catches up the next time you open the app.

## Commands

| Command                | What it does                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `/job-hunter:setup`    | First-time setup, or change your CV / what you're looking for                                     |
| `/job-hunter:cv`       | Read your CV (PDF or Word) into your profile and make a clean, ATS-friendly PDF                   |
| `/job-hunter:hunt`     | Run a search now (the daily run uses this too)                                                    |
| `/job-hunter:review`   | Where things stand, today's applications and to-dos, one approval, submit, follow-ups             |
| `/job-hunter:tailor`   | Tailored CV (and cover letter) for one job                                                        |
| `/job-hunter:linkedin` | Rewrite your LinkedIn (headline, About, roles, skills, Open to Work) as before/after you paste in |
| `/job-hunter:outreach` | Find who is hiring and draft short messages you send yourself; one follow-up                      |
| `/job-hunter:add`      | Add a job from any link or pasted job text (Rozee, LinkedIn, Indeed…)                             |
| `/job-hunter:inbox`    | Read jobs friends sent you in LinkedIn messages (attended, in your own Chrome) and add them       |
| `/job-hunter:daily`    | The unattended daily run (the 09:00 scheduled task calls it): hunt, prepare, one notification     |
| `/job-hunter:status`   | What's waiting for you, the pipeline counts, pause/resume                                         |

You can also just talk to it in plain English. The commands are shortcuts.

## Job sites covered

| Site                                                   | How it searches                                                                      | How you apply                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Remotive, Remote OK, Himalayas, Jobicy, Working Nomads | Official public feed                                                                 | On the employer's site                              |
| We Work Remotely                                       | RSS feed                                                                             | On the employer's site                              |
| Company career sites on Greenhouse, Lever, Ashby       | Public job-board feeds (a shared watch-list of companies)                            | **B**: it fills, you submit                         |
| Mustakbil.com                                          | Its RSS feed (Pakistani jobs, with salaries)                                         | **C**: action card (needs a free Mustakbil account) |
| Rozee.pk, LinkedIn Jobs, Indeed                        | Web search, or links you paste or friends send (these sites block automated reading) | **C**: action card                                  |
| **Any job link or pasted job text**                    | `/job-hunter:add`                                                                    | B or C                                              |

Planned next: Workable, SmartRecruiters and other public career-site feeds, and a
generic reader for any site you add.

Job Hunter never gets around a site that blocks automated reading. It finds those
listings through web search, or you paste the link.

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

| File in `~/JobHunter/`             | Holds                                                         |
| ---------------------------------- | ------------------------------------------------------------- |
| `profile.json`                     | Your master profile, the only source of facts it uses         |
| `searches.json`                    | What you're looking for                                       |
| `answers.json`                     | Your saved screening-question answers                         |
| `jobs.jsonl`, `matches.json`       | Jobs found, and how each was judged and ranked                |
| `applications.json`                | Every application, its answers, to-dos and status             |
| `profile.drafts.json`, `gaps.json` | Claims waiting for your OK; questions still open              |
| `cv/`                              | Your clean CV and tailored CVs (PDF) and what changed in each |
| `log.jsonl`                        | Everything Job Hunter did, and everything you marked done     |
| `settings.json`                    | Paused, sites on/off, usage setting                           |
| `meta.json`                        | Data-folder version, so updates can upgrade your files safely |

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
Job Hunter never logs in for you and never runs on LinkedIn by itself. It only reads your
LinkedIn messages (or fills a form) in your own signed-in Chrome, in a session you
started and are watching, at a normal human pace. It stops and hands back to you at any
CAPTCHA, "unusual activity" notice or warning, and never tries to get around one.

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
Paste any job link or the job text with `/job-hunter:add`. Adding whole sites to the
daily search is planned.

---

## For developers

Read **[CLAUDE.md](CLAUDE.md)** first. It's the guide for anyone (human or agent)
changing the code, including the hard safety rules.

### Spec-driven workflow

Every change goes **spec → plan → tasks → code**, and the owner reviews each step.

| Doc                                                                |                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| [`specs/0001-job-hunter/spec.md`](specs/0001-job-hunter/spec.md)   | What and why; decisions D1–D25; acceptance criteria |
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

| Check              | Command                      | Enforces                                                                                                                                                     |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types              | `npm run typecheck`          | Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …)                                                                              |
| Lint               | `npm run lint`               | Type-aware typescript-eslint, size/complexity limits, banned imports (browser automation, paid AI SDKs, heavy utility libraries), no packages in plugin code |
| Format             | `npm run format:check`       | Prettier                                                                                                                                                     |
| Tests              | `npm run test`               | Vitest, coverage ≥ 80% on `plugin/src/` and `tools/privacy/`                                                                                                 |
| Dead code          | `npm run knip`               | No unused files, exports or dependencies                                                                                                                     |
| Eligibility report | `npm run report:eligibility` | Rule accuracy on the 100 labelled jobs (not part of `check`)                                                                                                 |
| Privacy            | `npm run privacy`            | No emails, phone numbers, CNICs, home paths, CVs or data files in the repo                                                                                   |
| **All**            | `npm run check`              | Everything above. CI runs this on every push and PR                                                                                                          |

The **pre-commit hook** runs the privacy guard on staged files, then typecheck, lint,
format and tests. A failing check blocks the commit.

### Layout

```
.claude-plugin/   marketplace manifest → ./plugin
plugin/           the plugin itself: the only folder users install
  skills/         one folder per slash command (SKILL.md)
  src/            schema/, store/, connectors/, pipeline/, hunt/, cv/, apply/
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

**In daily use since 1 Nov 2026.** See [tasks.md](specs/0001-job-hunter/tasks.md).

- [x] Foundations: data folder, 10 job sources, Pakistan eligibility, scam and duplicate
      rules, CV → profile → clean PDF
- [x] Full loop: setup interview → daily hunt → matching → tailored CVs (honesty and
      recruiter-rules checks) → prepared applications → one notification → batch
      approval → form fill → submit → tracking and follow-ups
- [x] Lever/Ashby/Greenhouse forms, action cards, LinkedIn rewrite, hiring-team messages,
      jobs from LinkedIn messages (attended)
- [ ] Next: fixes from the first live run, morning update with open asks, more career-site
      feeds, daily exchange rates
- [ ] Later: local dashboard, learning from your picks, friends' onboarding

## License

Private, personal project. All rights reserved.
