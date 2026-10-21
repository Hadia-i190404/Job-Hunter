# Spec: Job Hunter

- **ID:** 0001-job-hunter
- **Status:** Agreed (20 Oct 2026)
- **Owner / reviewer:** project owner (personal project, personal GitHub)
- **Date:** 20 Oct 2026

> _What_ and _why_ only. The _how_ is in `plan.md`.

## Decisions so far (20 Oct 2026)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Name: **Job Hunter**. Personal project, own GitHub repo, no link to any employer account or email.                                                                                                                                                                                                                                                                                   |
| D2  | Users: the owner and a few friends, using it for real job hunts. Treat them as real users.                                                                                                                                                                                                                                                                                           |
| D3  | **Hybrid actions.** Anything on a site where the user is logged in (LinkedIn, Indeed, Rozee, …) is _prepared_ by the agent and _performed_ by the user: the agent notifies, hands over ready-to-paste text, the right file and a direct link; the user clicks. This keeps accounts safe from bans.                                                                                   |
| D4  | **No running cost** beyond each user's Claude plan. No servers, no paid APIs, no hosting. It runs where the user already is: the Claude desktop app.                                                                                                                                                                                                                                 |
| D5  | **No platform is cut** from the first list.                                                                                                                                                                                                                                                                                                                                          |
| D6  | **Focus:** on-site and hybrid jobs **in Pakistan**, and **remote jobs from any country** that a person in Pakistan can actually take. Relocating abroad for an on-site job is not a v1 track.                                                                                                                                                                                        |
| D7  | English only.                                                                                                                                                                                                                                                                                                                                                                        |
| D8  | Local Pakistani CV extras (photo, CNIC, father's name, DOB, marital status) are not used in any CV. If a base CV has them, they are dropped.                                                                                                                                                                                                                                         |
| D9  | The owner reviews every step (spec → plan → tasks → each change).                                                                                                                                                                                                                                                                                                                    |
| D10 | Each friend uses **their own Claude account, Pro or higher** (Claude Code is not on the Free plan; sharing one login breaks Anthropic's terms). They install the plugin from the GitHub repo once and get the owner's updates automatically.                                                                                                                                         |
| D11 | Works on **Pro**: a "light" usage setting (fewer jobs judged by Claude per day, more left to the free scripts) is the default; Max users can raise it.                                                                                                                                                                                                                               |
| D12 | Daily run 9:00 PKT + catch-up when the app opens.                                                                                                                                                                                                                                                                                                                                    |
| D13 | Group-shared items (added sites, employer learnings, scam reports, company watch-list) live in the GitHub repo's `plugin/shared/` folder. Code on GitHub is fine; no hosting or database.                                                                                                                                                                                            |
| D14 | The plugin ships with **zero runtime dependencies** (decided 21 Oct 2026, T2). Installing or updating downloads only Job Hunter's own files, never a `node_modules`. Found in T2: otherwise every install pulled 131 MB of dev tools, with a 60-second limit.                                                                                                                        |
| D15 | **CVs are made as PDF only** for now (T7). Word (.docx) CVs can be _read_, but writing them would need a hand-built zip/XML writer (D14). Revisit if a site the group uses insists on Word.                                                                                                                                                                                          |
| D16 | **Gaps are asked about, never filled in** (21 Oct 2026). When a job or a job search needs experience the profile doesn't show, Job Hunter asks the user whether they have it; what they describe becomes profile entries only after they approve the wording, tagged "added by you" with a date. If the answer is no, it stays a gap. See R5b.                                       |
| D17 | **CV content policy** (21 Oct 2026). Client names never appear: describe the client by type ("a global executive search firm"). True figures **should** appear wherever they show scale or impact (document counts, %, users, batch sizes): recruiters and ATS ranking reward measurable results. Vendor and tool names (CRMs, APIs, frameworks) are fine and help keyword matching. |
| D18 | **Master profile vs sent CV** (21 Oct 2026). The master profile holds every true fact, however long. A CV that gets sent is always tailored to one job with the ATS rules in R5 and fits on 1–2 pages. The untailored "clean CV" is a review copy, not something to send.                                                                                                            |

## Problem / motivation

Job hunting from Pakistan means checking a dozen-plus sites, retyping the same CV,
and applying to "remote" jobs that silently reject Pakistan by location, hours or
payroll. LinkedIn profiles go unseen by recruiters. Generic auto-apply bots spray
applications at jobs you can't take and get LinkedIn accounts banned.

Job Hunter does the searching, sorting, judging and writing; the user stays in control
of everything that is sent in their name.

## Goals

1. The user describes what they want once and gives a base CV.
2. The agent and user agree on direction before any outward action.
3. The agent searches every platform on the list daily, and new platforms can be added.
4. Every job is judged for "can someone in Pakistan take this?", with a reason.
5. The LinkedIn profile is rewritten to be found by recruiters and pass ATS keyword
   searches — the user pastes the approved text.
6. For each chosen job: a tailored, truthful CV, application prepared (and filled where
   safe), and a message to the hiring team when one can be found.
7. One place shows what's found, what's waiting for the user, and what's been done.

## Non-goals (v1)

- Inventing or inflating anything on a CV, profile or message.
- Clicking, typing or sending on any site where the user is logged in (D3).
- Bypassing CAPTCHAs, logins or rate limits.
- Servers, hosting, databases in the cloud, paid APIs (D4).
- On-site jobs outside Pakistan that need relocation/visa (D6).
- Freelance bidding (Upwork/Fiverr), interview prep, salary negotiation — later.

## Tracks

| Track                   | Example                                                | "Eligible" means                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pakistan on-site**    | Accountant, Karachi                                    | Job is in a city the user will work in                                                                                                                                                              |
| **Pakistan hybrid**     | Product designer, Lahore, 3 days office                | City match + office days acceptable                                                                                                                                                                 |
| **Remote, any country** | "Remote — worldwide", "Remote — EMEA", "Remote (Asia)" | Employer can hire someone in Pakistan (directly, as a contractor, or through an Employer-of-Record) and the required hours work from Pakistan time (UTC+5) — or the user said night shifts are fine |

## How the user works with it

- **Chat:** the user talks to Job Hunter in the Claude desktop app ("set me up",
  "find me jobs", "tailor my CV for this one", "what's waiting for me?").
- **Daily run:** once a day it searches, scores, prepares, and sends a desktop
  notification: "7 new matches, 3 things waiting for you".
- **Dashboard:** a page on the user's own computer showing matches, the to-do queue
  and the pipeline. Nothing is hosted.

## Action levels (D3 made concrete)

| Level                             | Who does it                                                                   | Used for                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Agent does it**             | Agent, fully                                                                  | Searching public listings, reading job pages, scoring, writing CVs/messages, building files                                                                                    |
| **B — Agent fills, you submit**   | Agent fills the form in the user's browser; **user checks and clicks Submit** | Application forms on company career sites that need no login (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, …)                                                          |
| **C — Agent prepares, you do it** | Agent makes an **action card**; user performs it and marks it done            | Everything on logged-in sites: LinkedIn profile edits, Easy Apply, messages and connection notes; Indeed/Rozee/Glassdoor/Wellfound/Bayt/etc. applies; any site needing a login |

An **action card** holds: what to do in one line, a direct link to the exact page,
each piece of text with a copy button (in the order the site asks for it), the right CV
file, answers to the expected screening questions, and "Done" / "Skip" / "Snooze".
The user can mark a card done from the dashboard or by telling the agent in chat.

A user may switch a non-LinkedIn platform from C to B later if they accept the risk;
LinkedIn is always C.

## User stories

### Setup & direction

- I give my CV (PDF/DOCX) and Job Hunter builds my profile; I correct what it got wrong.
- I add one or more **job searches**: role titles, seniority, experience range,
  industries, must-have skills, Pakistani cities, work modes (on-site / hybrid / remote),
  minimum salary (PKR or USD), employment type, notice period, night shifts OK?,
  companies to skip.
- When a job or search needs experience my CV doesn't show (say client-facing work for a
  forward deployed engineer role), it asks me whether I have it, turns my answer into
  profile entries I approve, and never adds anything I didn't say (D16, R5b).
- It reads back "who you are and what I'll look for", and lists gaps it spotted
  ("no numbers in your achievements", "most senior remote roles ask for X — do you have
  it?"). Nothing outward happens until I confirm.

### LinkedIn

- I get a rewritten headline, About, experience bullets, skills (ordered), and job
  preference settings (Open to Work — recruiters only, locations, remote/hybrid), plus
  the keyword set recruiters would search for.
- I see each section before/after, approve or edit, then get an action card per section
  to paste in. It re-checks monthly or when my searches change.

### Finding jobs

- Every day (and when I ask), it searches all platforms for each of my searches.
- Each job shows a match score, an eligibility verdict (Eligible / Likely / Unclear /
  Not eligible) and the reason ("Remote, but 'must live in the US'").
- The same job on five sites shows once.
- Suspected scams are hidden by default, with the reason.
- I can add a site it doesn't know by pasting a URL.
- I can thumbs-up/down jobs and it learns what I like.

### Applying

- I choose per search: **Review each** (default) or **Shortlist only** (I just want the
  list).
- For a job I pick, it makes a tailored CV (and cover letter if the job wants one) and
  shows exactly what changed from my base CV.
- Company career site (level B): it opens the form in my browser and fills it; I check
  and press Submit.
- Logged-in site (level C): I get an action card with link, CV file, and pre-written
  answers.
- It never guesses work-permission, legal, salary-not-yet-given or demographic answers
  — it asks me, and remembers my answer for next time.

### Hiring team

- When it can find who's hiring (named on the post, recruiter at the company, likely
  manager), it shows them with a confidence level and drafts a short, specific message.
- I get an action card to send it myself. It suggests at most one follow-up, and stops
  when they reply.

### Tracking

- Pipeline: Found → Shortlisted → Prepared → Applied → Messaged → Replied → Interview →
  Offer / Rejected / Withdrawn.
- A log of everything the agent did and everything I marked done.
- "Pause" stops the daily run and level-B filling at once.

## Requirements

### R1 — Profile & searches

- The base CV becomes a structured **master profile** (contact, summary, roles with
  dates and achievements, education, skills, certifications, languages, links). It is
  the **only** source of facts used anywhere.
- Several searches can be active at once.
- **Direction gate:** no CV tailoring for applying, no action cards, no form filling until
  the read-back is confirmed. Changing a search re-opens the gate for it and cancels its
  open action cards.

### R2 — Eligibility

- **Pakistan on-site/hybrid:** city match (Karachi, Lahore, Islamabad/Rawalpindi,
  Faisalabad, Peshawar, Multan, Hyderabad, Quetta, Sialkot, Gujranwala, …), office-day
  expectations.
- **Remote:** location wording ("worldwide", "anywhere", region lists, country
  allow/deny lists, "must reside in", "authorised to work in", "US/EU/UK only");
  required hours vs PKT; hiring model (contractor OK, Employer-of-Record that supports
  Pakistan, known to hire in Pakistan); what we've learned about that employer before
  (shared among our group).
- **Salary:** normalised to PKR and USD per month; "not stated" if missing, never
  guessed. Below-floor jobs are ranked lower, not hidden, unless the user says hide.

### R3 — Scam & quality filter

Flag and hide by default: fee requests (training, "processing", deposit, equipment),
WhatsApp-only or personal-email-only contact with no company identity, unrealistic
pay, known scam patterns, reposted-forever listings. Users can report a scam; it is
remembered for the group.

### R4 — Platforms (none cut — D5)

LinkedIn Jobs, Indeed (Pakistan + global), Rozee.pk, Mustakbil.com (added in T5), Bayt,
GulfTalent, NaukriGulf,
Glassdoor, Wellfound, Remote OK, We Work Remotely, Remotive, Himalayas, Jobicy, Working
Nomads, Arc.dev, Turing, plus company career pages on Greenhouse, Lever, Ashby,
Workable, SmartRecruiters, Recruitee, BambooHR and Workday.

- Gulf boards (Bayt, GulfTalent, NaukriGulf) are searched for Pakistan-located and remote
  jobs only (D6).
- Each platform has a **connector** that says what Job Hunter can do there: _search_,
  _read job_, _fill application_ (level B), _action card only_ (level C).
- **Searching is never done while logged in** to the user's accounts. If a platform has
  no public listings, it's searched through public web search, or the user pastes the
  job links / alert emails they got.
- **Add a site:** paste a site or search-results URL; Job Hunter tries a generic reader.
  If it gets usable jobs, the site is saved (for that user, or shared with the group).
- A broken or blocked connector is marked as such in the dashboard; nothing else stops.

### R5 — CV tailoring (truthful)

**ATS and recruiter rules every tailored CV follows (D17, D18):**

- **Keywords from the job:** use the job's own words for skills, tools and duties where
  the profile supports them (e.g. "forward deployed", "customer-facing", "solutions
  engineering"). Exact phrases, not synonyms, because ATS filters match literally.
- **Title line and summary aimed at the job:** the headline under the name and a 3–4
  line summary say why this person fits _this_ role, using its key terms.
- **Most relevant first:** within each role, the bullets that match the job go first.
  Weakly relevant bullets are cut, not shortened into vagueness. 3–6 bullets for recent
  roles, 1–3 for older ones.
- **Results, not duties:** each bullet reads "did X, using Y, achieving Z", with the real
  figure when the profile has one.
- **Skills list built for the job:** 12–25 skills, the job's required ones first, grouped
  if that reads better. Never the whole master list.
- **Length and layout:** 1–2 pages (≤ 3 years' experience: aim for 1 if it fits without
  losing key results); one column; standard headings; no tables, images, icons or
  text in headers and footers.
- **Truth stays fixed:** tailoring selects, orders and rephrases. It never adds a fact,
  raises a figure, or upgrades a title.

- Built from the master profile only: reorders and rewrites bullets towards the job's
  wording, picks relevant skills, adjusts the summary, 1–2 pages, ATS-safe layout
  (single column, standard headings, real text, no tables/images for content).
- No photo, CNIC, father's name, DOB, marital status or religion in any CV (D8).
- **Honesty check:** every claim in a tailored CV must trace to the master profile;
  anything that doesn't is removed before the user sees it. Missing requirements are
  reported as gaps, never added.
- ATS check per version: keyword coverage vs the job, parseability, with suggested fixes.
- Output PDF (D15), named `Firstname-Lastname-CV-<Company>.pdf`.

### R5b — Gap questions (D16)

- **When:** (a) at setup, for a job search aimed at a role the CV doesn't show (e.g.
  software engineer → forward deployed engineer, teacher → operations); (b) when
  tailoring for a job that asks for something the profile lacks.
- **Ask, don't assume:** name the missing area and give 3–5 concrete prompts the user
  can answer ("Have you joined client calls? Demoed to a client? Deployed at a client
  site?"). One round of questions per gap area, not per job.
- **Turn answers into entries:** draft profile entries from the user's own words, placed
  under the right role (or projects/skills). Wording may be made professional; scale may
  not grow: no added numbers, titles, tools, clients or frequency the user didn't state.
- **Approval:** each drafted entry is shown and approved, edited or rejected. Only
  approved entries are saved, tagged `source: user` with the date. CV-extracted entries
  are `source: cv`.
- **No:** a "no" or "not really" is respected. The gap is reported and the job's match
  reflects it. Tailoring may lean on related true entries but never implies the
  missing one.
- **Reuse:** approved entries serve every later CV, cover letter and screening answer.
  The same gap is never asked again unless the user wants to add more.

### R6 — Applying

- Level B: fill from master profile + tailored CV + answer bank; stop and ask on
  anything new or protected; never press Submit; hand over on CAPTCHA, login, tests,
  video steps.
- Level C: action card (see "Action levels").
- **Answer bank:** notice period, expected salary per currency, earliest start, years
  with each skill, links, relocation (no), night shifts, etc. Built up from the user's
  answers.
- Never prepare the same job twice (dedup across platforms); never for a skipped company.

### R7 — LinkedIn

All LinkedIn work is level C (D3): suggestions → before/after review → action cards.
The agent never logs in to, browses, or acts on LinkedIn as the user. Job discovery
on LinkedIn uses only public, logged-out listings.

### R8 — Hiring-team outreach

- Sources: the job post itself, the company's public team/careers pages, public web
  search. On LinkedIn, the user can paste the hiring-team names from the job page they
  are viewing.
- Drafts are short (≤ 300 characters for connection notes), name the specific role and
  one real, relevant fact from the profile.
- One person hiring for several of the user's picked jobs gets one message, not several.
- At most one follow-up, after a wait the user sets (default 7 days).

### R9 — Privacy & control

- Each user's data stays **on their own computer**, outside the code repo. Nothing
  personal is ever committed to GitHub.
- Only shared-by-choice items go to the group: added sites, employer learnings, scam
  reports — never CVs, profiles or answers.
- No passwords are stored or entered by Job Hunter.
- Every agent action and every user "done" is logged.
- Deleting a user's data folder removes everything about them.

### R10 — Notifications & dashboard

- Daily desktop notification with counts (new matches, cards waiting, follow-ups due).
- Dashboard (local page): Today (cards waiting), Matches (filters by search, verdict,
  platform, mode, city), Pipeline, Log, Settings (searches, platforms, pause).

## Use cases (coverage check)

| #   | Use case                                                                                         | Covered by                                                                 |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| U1  | Fresh grad, 0 years, wants trainee/intern roles in Lahore                                        | R1 exp range, R2 city, R5 projects-first CV                                |
| U2  | Mid-level dev wants remote USD roles worldwide                                                   | R2 remote, R6 level B on ATS sites                                         |
| U3  | Designer wants hybrid in Islamabad only                                                          | R1 mode + city, R2 office days                                             |
| U4  | Career switcher (teacher → ops)                                                                  | R1 gaps, R5b gap questions at setup, R5 transferable framing, no invention |
| U5  | Senior wants a few good roles only                                                               | Shortlist-only, R8 outreach first                                          |
| U6  | User currently abroad, moving back to Pakistan                                                   | R1 current location ≠ target city                                          |
| U7  | Happy to work US hours                                                                           | R2 night-shift preference                                                  |
| U8  | Employment gap                                                                                   | R5 honest gap handling, no date fudging                                    |
| U9  | Same job on five boards                                                                          | R4/R6 dedup                                                                |
| U10 | Fee-charging "work from home" job                                                                | R3                                                                         |
| U11 | Form asks "Are you authorised to work in the US?"                                                | R6 ask, never guess                                                        |
| U12 | CAPTCHA/login during level-B fill                                                                | R6 hand over                                                               |
| U13 | Site we don't search (niche Pakistani board)                                                     | R4 add a site                                                              |
| U14 | Recruiter replies on LinkedIn                                                                    | User marks "Replied" (chat or dashboard)                                   |
| U15 | User changes direction mid-search                                                                | R1 gate re-opens, cards cancelled                                          |
| U16 | User's laptop was off at run time                                                                | Next run catches up; nothing lost                                          |
| U17 | Platform blocks the public listing reader                                                        | R4 connector marked broken; web-search fallback                            |
| U18 | User wants to stop everything                                                                    | R9/R10 pause                                                               |
| U19 | Software engineer applying for a forward deployed engineer role; client work missing from the CV | R5b: asked once, approved entries added, reused for every similar job      |
| U20 | User says they don't have the missing experience                                                 | R5b: stays a gap, match lowered, nothing implied                           |

## Edge cases

- Scanned-image CV → read with OCR, user confirms the facts.
- Multi-column / Canva CV → parse; low-confidence fields marked for confirmation.
- Job closed before the user acts → card closes itself, marked Closed.
- Form has a field type the agent doesn't understand → stop, leave it for the user.
- No hiring contact found → no message; never a made-up contact.
- Salary in another currency/period → normalised; missing → "not stated".
- Two searches match one job → shown once, tagged with both.
- Daily run hits Claude usage limits → it finishes what it can, says what's left, and
  continues next run.

## Acceptance criteria

- [ ] A user can go from install to first confirmed read-back in under 15 minutes.
- [ ] CV parsing gets ≥ 90% of fields right on a test set of 10 real CVs from our group.
- [ ] No action card, CV-for-applying or form filling is possible before confirmation.
- [ ] The daily run returns jobs from every v1 platform that has public listings, and
      the dashboard shows the status of every platform (working / fallback / broken).
- [ ] Duplicate jobs across platforms appear once.
- [ ] Every job has a verdict + reason; on 100 hand-labelled remote jobs, "Eligible /
      Likely" is right ≥ 90% of the time.
- [ ] A new site can be added by URL and returns jobs for at least 3 of 5 test sites.
- [ ] A gap question produces profile entries only after approval; approved entries are
      tagged `source: user` with a date; a "no" adds nothing (tested on 5 gap cases).
- [ ] Gap-question entries never add numbers, titles, tools or scale the user didn't
      state (checked against their answers).
- [ ] Tailored CVs contain no fact missing from the master profile (checked on 20 CVs),
      and never contain photo/CNIC/father's name/DOB/marital status.
- [ ] Tailored CVs are read correctly by at least one free ATS-style parser check.
- [ ] Level B fills Greenhouse, Lever, Ashby and Workable test forms, stops before
      Submit, and stops on work-permission/salary questions not in the answer bank.
- [ ] Job Hunter never types into, clicks on, or sends anything on a logged-in site
      (checked by review of the code and the log).
- [ ] Every LinkedIn change and message reaches the user as an action card with copy
      buttons, a link and Done/Skip.
- [ ] Desktop notification arrives after each daily run.
- [ ] Nothing personal is in the git repo (checked by a pre-commit guard).
- [ ] Running it costs nothing beyond each user's own Claude plan.
- [ ] A friend on a Pro plan can install it from GitHub, run setup and a daily run in light
      mode without hitting usage limits on a normal day.
- [ ] A change pushed by the owner reaches a friend's install without them reinstalling.

## Open questions

- None blocking. To confirm in P0: scheduled tasks and plugin auto-update work on a Pro
  account (docs list no plan limit, but we test it on a friend's account).
