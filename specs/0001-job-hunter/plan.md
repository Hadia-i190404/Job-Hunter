# Plan: Job Hunter

- **Spec:** ./spec.md
- **Status:** Agreed (20 Oct 2026)

## Approach

Job Hunter is a **Claude Code plugin** plus a few small local scripts. No server, no
hosting, no paid API (spec D4).

- **The brain** is Claude, running inside each user's own Claude desktop app on their
  own plan. Skills (slash commands) hold the instructions for each job: setup, hunt,
  tailor, apply, LinkedIn, outreach, status.
- **The legwork** that needs no thinking is done by plain Node scripts: fetching public
  listings, normalising, deduplicating, first-pass eligibility rules, rendering CVs,
  building the dashboard. This saves Claude usage for the parts that need judgement.
- **The data** lives in a folder on the user's computer (`~/JobHunter/`), never in the
  repo.
- **The daily run** is a scheduled task in the Claude desktop app that runs the hunt
  and sends a desktop notification.
- **Level-B form filling** (career sites with no login) uses the Claude desktop app's
  built-in browser; Claude in Chrome also works. The user always clicks Submit.
- **Level-C action cards** are shown in the local dashboard with copy buttons. Job Hunter
  never touches logged-in sites.

Why: this is the only setup that costs nothing extra, needs no deployment, and lets
each friend run it on their own laptop with their own data.

## Repo layout (`github.com/Hadia-i190404/Job-Hunter`)

```
Job-Hunter/
├── .claude-plugin/marketplace.json # marketplace → "./plugin"
├── plugin/                         # the only folder users install (D14: zero deps)
│   ├── .claude-plugin/plugin.json  # no "version" → every commit is an update
│   ├── skills/
│   │   ├── status/       SKILL.md  # what's waiting, pause/resume, dashboard (T2)
│   │   ├── setup/        SKILL.md  # CV → profile, searches, read-back, confirm gate
│   │   ├── hunt/         SKILL.md  # daily run: fetch → score → prepare → notify
│   │   ├── review/       SKILL.md  # walk through new matches in chat
│   │   ├── tailor/       SKILL.md  # tailored CV + honesty check + ATS check
│   │   ├── apply/        SKILL.md  # level B fill / level C card
│   │   ├── linkedin/     SKILL.md  # profile rewrite → cards
│   │   ├── outreach/     SKILL.md  # hiring team + message cards + follow-ups
│   │   └── add-site/     SKILL.md  # paste a URL → generic connector
│   ├── src/                        # TypeScript run by Node's type stripping, no build
│   │   ├── schema/                 # hand-written validators (no zod: D14)
│   │   ├── store/  connectors/  pipeline/  cv/  dashboard/
│   ├── scripts/                    # CLI entry points the skills run
│   ├── templates/                  # cv.html, cover-letter.html (ATS-safe)
│   └── shared/                     # group-shared, no personal data (D13)
├── tools/                          # dev-only: privacy guard
├── tests/                          # vitest
└── specs/
```

**Consequences of D14 (zero dependencies):**

- Validation is hand-written in `plugin/src/schema/`, not zod.
- PDF CVs come from headless Chrome (`--print-to-pdf`). The ATS "text-back" check is done
  by Claude reading the PDF (Claude Code reads PDFs natively), which is close to what an
  ATS parser does.
- DOCX output needs a zip writer. Node's `zlib` can do it, so decide in T7 whether DOCX is
  worth it or PDF is enough.
- The plugin's scripts find a Node ≥ 22.18 even when the user's default `node` is older
  (the owner's is v20). `plugin/scripts/run.sh` does this (T3).

## Data folder (`~/JobHunter/`, per user, never committed)

| File                | Holds                                                          |
| ------------------- | -------------------------------------------------------------- |
| `profile.json`      | Master profile (versioned) — the only source of facts          |
| `searches.json`     | Job searches + gate state (confirmed at, version)              |
| `answers.json`      | Answer bank for screening questions                            |
| `jobs.jsonl`        | Canonical jobs with dedup group, source links, first/last seen |
| `assessments.jsonl` | Per job: match score, verdict + reasons, scam flag, thumbs     |
| `pipeline.json`     | Job → stage, dates, CV version used, contacts                  |
| `cards.json`        | Action cards: type, link, text blocks, file, status            |
| `cv/`               | Tailored CVs (PDF/DOCX) + their diffs vs the master profile    |
| `log.jsonl`         | Every agent action and every user "done"                       |
| `settings.json`     | Paused?, platform on/off, per-search mode, follow-up wait      |
| `meta.json`         | Schema version + created date; drives migrations (T3)          |

Plain JSON so Claude can read it directly and the user can back it up by copying the
folder.

## Connectors

```ts
interface Connector {
  id: string; // 'remotive', 'rozee', 'greenhouse', 'generic:<host>'
  kind: 'api' | 'feed' | 'public-html' | 'web-search' | 'paste-only';
  search(s: SearchQuery): AsyncIterable<RawJob>; // never logged in
  readJob?(url: string): Promise<RawJob>;
  applyLevel: 'B' | 'C'; // B only for no-login career-site forms
}
```

| Platform                                                       | First way in                                          | Fallback                                  | Apply level                |
| -------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | -------------------------- |
| Remotive, Remote OK, Himalayas, Jobicy, Working Nomads         | Public API / JSON                                     | —                                         | via employer's site        |
| We Work Remotely                                               | RSS                                                   | —                                         | via employer's site        |
| Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee | Public job-board APIs for companies on the watch-list | web search                                | **B**                      |
| BambooHR, Workday                                              | Public career pages                                   | web search                                | B where no login, else C   |
| Rozee.pk, Bayt, GulfTalent, NaukriGulf                         | Public listing pages, low volume                      | web search (`site:`)                      | C                          |
| LinkedIn Jobs                                                  | Public logged-out job search, low volume              | web search; user pastes links             | **C always**               |
| Indeed, Glassdoor                                              | Public pages (often blocked by bot checks)            | web search; user forwards job-alert links | C                          |
| Wellfound, Arc.dev, Turing                                     | Public pages                                          | web search                                | C                          |
| Added sites                                                    | `generic` reader (Claude reads the page)              | —                                         | B if no-login form, else C |

Honest expectation: some big boards block automated reading even when logged out.
For those, the fallback (web search for their listings, or the user pasting links from
job-alert emails) is the realistic main route. The dashboard shows which way each
platform is working.

**Company watch-list:** companies that hire remotely in Pakistan are collected from the
aggregators and from what the group learns, then their own ATS boards are polled
directly. These are the best jobs to apply to (level B, real employer, no middleman).

## The daily run (`/job-hunter:hunt`)

1. Script: fetch all enabled connectors for every confirmed search → `jobs.jsonl`.
2. Script: normalise (title, company, city, mode, salary → PKR + USD/month), dedup.
3. Script: rules — city match, obvious location blocks ("US only", "must reside in"),
   scam patterns, skipped companies. Clear rejects stop here (no Claude usage).
4. Claude: for what's left, eligibility verdict + reason, match score, scam check.
   Capped per run by the usage setting (light ~25, full ~60); the rest wait.
5. Claude: for top matches in "Review each" searches, prepare a card "Review & tailor".
   Due follow-ups become cards.
6. Script: rebuild dashboard data; desktop notification with counts.

## Tailoring & honesty check (`/job-hunter:tailor`)

1. Claude writes the tailored CV as structured JSON, **each bullet citing the profile
   item it comes from**.
2. Honesty check (separate step): every bullet/skill is compared to its cited source;
   anything new (number, tool, title, date, employer, degree) is removed and listed.
3. Script renders HTML → PDF (headless Chrome `--print-to-pdf`, already installed) and
   DOCX (decided in T7, see D14).
4. ATS check: extract text back from the PDF and confirm sections, dates and contact
   info come out cleanly; keyword coverage vs the job.
5. Show diff vs base CV + gaps; save to `cv/`.

## Applying (`/job-hunter:apply`)

- **Level B:** open the form in the built-in browser, fill from profile + answers + CV
  upload, stop on unknown/protected questions, CAPTCHA or login; never press Submit;
  tell the user it's ready to check. User submits, then says "done" (or the agent sees
  the confirmation page) → stage Applied.
- **Level C:** create an action card (link, ordered text blocks, CV file, expected
  answers). User does it, presses Done in the dashboard or says so in chat.

## Dashboard

`npm run dashboard` (or the agent starts it) → `http://localhost:4600`. Today / Matches /
Pipeline / Log / Settings. Copy buttons, Done/Skip/Snooze write to `cards.json`
directly. Stopped when not needed; nothing is hosted.

Option to try in P0: the same dashboard as a private claude.ai Artifact, which would
also work on a phone. Decide after the spike based on what it needs to store there.

## Safety guards (built in, not just instructions)

- **Logged-in sites:** connectors for C-level platforms have no fill/click code at all;
  the apply skill refuses level B for any host on the C list.
- **Gate:** tailor/apply/linkedin/outreach skills check `searches.json` confirmation first.
- **No personal data in git:** data folder is outside the repo; `.gitignore`; a
  pre-commit hook that blocks emails, phone numbers, CNIC patterns and `~/JobHunter`
  paths in staged files (except test fixtures with fake data).
- **Git identity:** the repo sets its own `user.name`/`user.email` to the owner's
  personal account (this machine's global git email is a work address).
- **Pause:** `settings.json.paused` is checked by every skill and the scheduled run.

## Installing (per user) and getting updates

1. Claude desktop app, signed in with **their own** Claude plan (Pro or higher).
2. In Terminal: `claude plugin marketplace add Hadia-i190404/Job-Hunter`, then
   `claude plugin install job-hunter@job-hunter`. The `/plugin` command isn't available in
   the desktop app (found in T2).
3. Node 22.18+ installed. Nothing else: there is no `npm install` for users.
4. New session → `/job-hunter:setup`, give the CV, add searches, confirm.
5. Setup creates the 9:00 PKT daily scheduled task.

**Updates:** the plugin manifest has **no `version` field**, so every commit pushed to
`main` is a new version. For now users update with `claude plugin marketplace update
job-hunter` + `claude plugin update job-hunter@job-hunter`. T9 tests whether auto-update
can replace that. The owner builds; friends do nothing. Breaking
changes to the data folder come with a migration the skills run on first use.

**Usage setting:** `settings.json.usage` = `light` (default, for Pro: ~25 jobs judged
by Claude per run, tailoring only on request) or `full` (Max: ~60 per run, auto-prepares
top matches).

## Phases

| Phase                        | Ships                                                                                                                                                                                                                                 | Done when                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **P0 — Spike**               | Plugin skeleton, data folder, 3 connectors (Remotive, Greenhouse, Rozee), rule eligibility on 100 jobs, CV parse → render → text-back on 3 real CVs, level-B fill of one Greenhouse form, scheduled run + notification, install steps | Each risky piece works once end to end |
| **P1 — Set up & find**       | Setup skill + gate, all v1 connectors with fallbacks, dedup, eligibility, scams, matching, add-a-site, dashboard (Matches + Settings), daily run                                                                                      | Owner gets a useful daily list         |
| **P2 — Tailor & apply**      | Tailoring + honesty check + ATS check, answer bank, level B on Greenhouse/Lever/Ashby/Workable, level-C cards, pipeline                                                                                                               | Owner applies to real jobs with it     |
| **P3 — LinkedIn & outreach** | LinkedIn rewrite → cards, hiring-team finder, message cards, follow-ups                                                                                                                                                               | Profile updated, messages going out    |
| **P4 — Group**               | Shared sites/employers/scams via repo, thumbs learning, onboarding friends                                                                                                                                                            | Friends running it on their machines   |

## Risks & trade-offs

- **Blocked boards** — Indeed/Glassdoor/LinkedIn may block even logged-out reading.
  Fallbacks are web search and pasted links; we'll know in P1 which works.
- **Claude usage limits** — a daily run plus tailoring can be heavy. Scripts filter
  first, per-run cap, and cached verdicts per job (eligibility doesn't depend on the user).
- **Only runs when the laptop is on** — the trade-off for zero hosting. Catch-up run on
  app open.
- **Scheduled tasks / plugins in the desktop app** — confirm in P0 that both work as
  described on each friend's plan.
- **Form drift** — ATS forms change. Level B never submits, so the worst case is a
  half-filled form the user finishes.
- **LLM "improving" facts** — handled by citations + separate honesty check.

## Test strategy

- vitest for normalise, dedup, salary, location, rule eligibility, scam rules, store,
  pre-commit guard.
- Labelled sets: 100 remote jobs (eligibility), 20 scam postings, 10 group CVs (parse,
  kept in each owner's data folder, never committed), 20 tailored CVs (honesty).
- Saved form fixtures for Greenhouse/Lever/Ashby/Workable + one live test posting each.
- Walk through every acceptance criterion in the spec with the owner.
