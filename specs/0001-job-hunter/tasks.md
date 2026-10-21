# Tasks: Job Hunter

- **Spec:** ./spec.md
- **Plan:** ./plan.md

> Small, ordered, independently verifiable. Tags: `[repo]` tooling/docs, `[core]` src/
> scripts, `[skill]` plugin skills, `[spike]` a one-off test whose result goes back
> into the spec/plan. Each task is reviewed by the owner before the next one starts.
> P1–P4 are broken down into tasks after P0 is reviewed.

## P0 — Spike

- [x] `[repo]` **T1 Foundation.** README, agent guide (`CLAUDE.md`), strict TypeScript,
      ESLint (type-aware), Prettier, Vitest with coverage thresholds, Knip (dead code /
      unused deps), privacy guard + its tests, pre-commit hook, GitHub Actions CI,
      `.gitignore`, local git identity.
      _Done when:_ `npm run check` passes on a clean install; the pre-commit hook blocks
      a staged file with a fake CNIC.
- [x] `[repo]` **T2 Plugin skeleton.** `.claude-plugin/plugin.json` (no `version`
      field) + `marketplace.json`; one working skill `/job-hunter:status` that reads the
      data folder and says "not set up yet".
      _Done when:_ installed from GitHub in the desktop app on the owner's account.
- [x] `[repo]` **T2b Zero-dependency plugin.** Plugin moved into `plugin/` (marketplace
      `source: ./plugin`); dev tools to repo root / `tools/`; lint blocks package imports
      in plugin code; `tsx` dropped for Node's type stripping (Node 22.18+); README
      install/update steps use the `claude plugin` CLI (no `/plugin` in the desktop app).
      _Done when:_ a fresh install has no `node_modules` and `/job-hunter:status` works.
- [x] `[core]` **T3 Store.** `~/JobHunter/` (or `JOB_HUNTER_HOME`) created private
      (0700/0600); hand-written validators (`plugin/src/schema/`); atomic writes with a
      `.bak` copy and recovery from it (damaged file kept as `.corrupt-<time>`); schema
      version in `meta.json` + ordered migrations (refuses a folder from a newer plugin);
      append-only `log.jsonl`; settings + `paused`; `run.sh` launcher that finds
      Node ≥ 22.18; `store.ts` CLI (`status|init|pause|resume`) used by the status skill.
      Schemas for jobs, profile, searches, answers, cards and pipeline are added by the
      tasks that design them (T4, T7, P1, P2).
      _Done when:_ unit tests cover read/write/migrate/corrupt-file recovery. ✔ 52 tests.
- [x] `[core]` **T4 Job model + normalise.** `RawJob` → `Job` (`plugin/src/pipeline/`):
      title clean-up (urgent/hiring/emoji/job-id noise), company display + `companyKey`
      (Pvt Ltd, SMC, FZ-LLC…), 31 Pakistani cities with aliases (Isb/Rwp, twin cities,
      Indian Hyderabad excluded), on-site/hybrid/remote, salary (Rs/lakh/k, $, AED, SAR,
      €, £…; period stated or inferred, else "not stated") → PKR and USD per month.
      FX rates are approximate and dated (`fx.ts`); refreshing them is a P1 job.
      _Done when:_ unit tests on 40 real-world strings pass. ✔ 79 examples.
- [x] `[core]` **T5 Three connectors.** Remotive (API), Greenhouse (board API per
      watch-list company, level B), **Mustakbil.com** (RSS + schema.org data on job pages)
      instead of Rozee.pk, which blocks every script with a Cloudflare check (Rozee →
      web-search/paste fallback in P1). Shared parts: polite per-host HTTP client
      (one at a time, pause, identifies itself, reports bot checks as "blocked"),
      HTML→text, RSS reader, schema.org JobPosting reader (the base for "add a site"),
      title keyword matching. CLI: `fetch.ts --source … --q … --city … --board …`.
      Remotive's free API caps at 10 jobs per request, so 1 request per phrase, max 3.
      _Done when:_ each returns real jobs; parsers tested against saved fixtures.
      ✔ Live 21 Oct: Remotive 1 React job; Mustakbil 14 accountant jobs with PKR
      salaries; Greenhouse 73 GitLab engineering jobs. 164 tests.
- [x] `[core]` **T6 Dedup + rule eligibility + scam rules.** `pipeline/eligibility.ts` +
      `places.ts` (60 countries, regions with how they relate to Pakistan, US-hours =
      night-shift flag, contractor/EOR note, restriction sentences quoted as the reason);
      `scam.ts` (weighted: a fee request alone is enough; one weak signal like WhatsApp
      isn't); `dedup.ts` (company + title words + place; best copy wins); `store/jobs.ts`
      (jobs.jsonl upsert, keeps first-seen, drops after 60 days unseen); `fetch.ts --save`.
      Labelled sets in `tests/fixtures/labelled/` (100 real location fragments, 20 + 20
      synthetic scam/ordinary posts). **Labels are Claude's: owner to review.**
      _Done when:_ report shows rule-only precision/recall; ambiguous ones listed for
      the Claude step. ✔ `npm run report:eligibility`: "eligible/likely" precision 100%,
      "not eligible" recall 100%, 15/100 sent to Claude. Scams 20/20 caught, ordinary
      20/20 passed. Live 21 Oct: 180 GitLab + Canonical engineering jobs → 56 open to
      Pakistan, 90 ruled out with reasons, 34 for Claude. 223 tests.
- [ ] `[core]` `[skill]` **T7 CV round trip.** ✔ Built: `/job-hunter:cv` skill (PDF via
      Read, Word via `cv.ts docx-text`; copy facts, never improve; drops CNIC/DOB/etc.),
      `profileSchema` with ids for citations, `cv.ts save-profile|render`, ATS-safe
      HTML/CSS (A4, one column), headless Chrome with a throwaway profile, PDF 0600,
      Claude reads the PDF back as the ATS check. PDF only (D15). Fake-profile round trip
      reads back cleanly; 235 tests.
      _Done when:_ 3 real CVs (kept in the data folder, never committed) round-trip with
      ≥ 90% fields right. **⏳ Waiting for the owner's CV (+ 2 friends').**
- [ ] `[spike]` **T8 Level-B fill.** Fill one public Greenhouse test application in the
      built-in browser from the profile; stop before Submit; stop on a work-permission
      question. _Done when:_ recorded walkthrough + notes.
- [ ] `[spike]` **T9 Desktop app facts.** On the owner's account **and a friend's Pro
      account**: scheduled task at 9:00 PKT runs `/job-hunter:status` and notifies;
      a pushed commit reaches the friend via plugin auto-update.
      _Done when:_ both confirmed or the plan is changed.
- [ ] `[repo]` **T10 P0 review.** Write findings, update spec/plan, break P1 into tasks.

## P1 — Set up & find _(to be broken down)_

Setup skill + gate, all v1 connectors + fallbacks (Rozee via web search / pasted
alert links), daily FX-rate refresh from a free
source, add-a-site, Claude eligibility/match
step with usage caps, dashboard (Matches, Settings), daily run.

## P2 — Tailor & apply _(to be broken down)_

Tailoring + honesty check + ATS check, answer bank, level B on Greenhouse / Lever /
Ashby / Workable, level-C action cards, pipeline.

## P3 — LinkedIn & outreach _(to be broken down)_

## P4 — Group _(to be broken down)_

## Verification (every task)

- [ ] `npm run check` passes (typecheck, lint, format, tests + coverage, knip, privacy).
- [ ] The task's "Done when" is shown to the owner.
- [ ] Spec/plan updated if reality differed.
