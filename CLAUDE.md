# Job Hunter — Agent guide

Job Hunter is a Claude Code plugin that finds jobs for people in Pakistan, judges whether
they can actually take them, and prepares truthful applications. It's a personal project
for a small group of friends who use it for real job hunts. Treat them as real users.

**Read before any work:** `specs/0001-job-hunter/spec.md` (what and why, decisions
D1–D13), `plan.md` (how), and `tasks.md` (what's next). The README explains the product
to users.

## Workflow: spec-driven, and the owner reviews every step

1. **Spec**: what and why. 2. **Plan**: how. 3. **Tasks**: small, ordered, each with a
   "Done when". 4. **Implement** one task at a time. 5. **Verify** with `npm run check` plus
   the task's "Done when".

- Don't write code for something that has no agreed spec and plan. New feature means a
  new `specs/NNNN-slug/` folder (next number after the highest one there).
- Stop after each task and show the owner the result before starting the next one.
- When reality differs from the spec or plan, update them in the same change.
- Commit or push only when the owner asks. Never use `--no-verify`.

## Hard rules (product safety). These are never traded for convenience.

1. **Never act on a logged-in site.** No clicking, typing, sending or submitting on
   LinkedIn, Indeed, Rozee, Glassdoor, Wellfound, Bayt, GulfTalent, NaukriGulf, or any site
   that needs the user's login. Those get an **action card** (level C). LinkedIn is
   always level C.
2. **Never press Submit.** Level B (no-login career-site forms) fills the form, then
   stops for the user.
3. **Never invent facts.** Every claim on a CV, profile or message must trace to the
   master profile. Gaps are reported, never filled.
4. **Never guess protected answers:** work permission, visa, legal declarations,
   demographics, or salary that isn't in the answer bank. Ask the user.
5. **Never handle passwords, CAPTCHAs or 2FA.** Hand over to the user.
6. **No personal data in the repo.** User data lives in `~/JobHunter/`. Test fixtures
   use fake data (`@example.com`, made-up names). The privacy guard enforces this.
7. **No running costs.** No servers, hosted databases, paid APIs or paid services. Claude
   runs through the plugin on each user's own plan. GitHub (repo, Actions) is fine.
8. **The direction gate.** Tailoring, cards, filling and outreach need a confirmed
   read-back (`searches.json`). Every skill also checks `settings.paused`.

## Stack

- **Node 22.12+**, **TypeScript** (strict) run directly with `tsx`. No build step.
- **Vitest** for tests, **ESLint** (typescript-eslint, type-aware), **Prettier**, **Knip**.
- **zod** at every boundary (files, fetched data, skill input/output). Added in T3.
- Claude Code **plugin**: skills in `skills/<name>/SKILL.md`. Added in T2.

## Structure

```
.claude-plugin/     plugin + marketplace manifests (T2)
skills/<name>/      SKILL.md per slash command: setup, hunt, review, tailor, apply, …
src/
  guard/            privacy guard (pure functions)
  store/            the ~/JobHunter/ data folder: schemas, read/write, migrations
  connectors/       one file per platform + generic.ts; all implement `Connector`
  pipeline/         normalise, dedup, salary, location, eligibility/scam rules
  cv/               render HTML→PDF/DOCX, text-back ATS check
  dashboard/        localhost dashboard
scripts/            CLI entry points (the only place console output is allowed)
templates/          ATS-safe CV / cover letter HTML
shared/             group-shared data, no personal data (D13)
tests/              mirrors src/; fixtures/ holds fake or scrubbed data only
specs/              spec → plan → tasks
```

## Code conventions

- **Small units.** Lint enforces: complexity ≤ 12, nesting ≤ 4, ≤ 4 params, ≤ 80 lines per
  function, ≤ 300 lines per file. If you hit a limit, split the code. Don't disable the rule.
- **Pure core, thin edges.** `pipeline/`, `guard/` and the CV logic are pure functions
  (data in, data out) and fully unit tested. I/O lives in `store/`, `connectors/` and
  `scripts/`.
- **Types:** no `any`, no non-null `!`. Parse unknown data with zod. Exported functions
  declare return types. Use `import type` for types. Import local files with `.ts`.
- **Errors:** connectors never throw past their boundary. They return a status
  (`ok | fallback | broken`) so one broken site never stops a run.
- **Logging:** product events go to the store log (`log.jsonl`), not `console`.
- **Naming:** files `kebab-case.ts`; types `PascalCase`; everything else `camelCase`.
- **Comments:** explain _why_, never _what_. Reference the spec (`R5`, `D3`) when a rule
  comes from it.

## Keep it lean (optimisation rules)

- **Scripts before Claude.** Anything a regex, a parser or a rule can do runs as a
  script. Claude is used only for judgement: ambiguous eligibility, matching, tailoring,
  honesty check and writing. Every Claude step has a per-run cap (`settings.usage`).
- **Cache by job, not by user.** Normalisation, eligibility and scam verdicts don't
  depend on the user. Compute them once per job.
- **Be polite to sites.** One request at a time per host, with a delay. Respect
  `robots.txt` for public HTML. Prefer official APIs and feeds over HTML.
  (`no-await-in-loop` is on. Disable it only for deliberate per-host pacing, with a
  comment.)
- **Concurrency across hosts:** fetch different platforms in parallel, the same platform
  sequentially.
- **Dependencies need a reason.** Prefer the standard library (`fetch`, `node:fs`,
  `Intl`). Banned imports are in `eslint.config.js`, with the reason for each. Knip must
  stay clean: no unused files, exports or dependencies.
- **Stream big things.** Large feeds and JSONL files are read line by line, never loaded
  whole into memory.

## Commands

```bash
npm install          # also installs the git pre-commit hook
npm run check        # everything CI runs: typecheck, lint, format, tests+coverage, knip, privacy
npm run test:quick   # tests without coverage
npm run format       # fix formatting
npm run privacy      # privacy guard on all tracked files
```

The **pre-commit hook** runs privacy guard (staged files), typecheck, lint, format check
and tests. **CI** (GitHub Actions) runs `npm run check` on every push and PR.

## Testing

- Tests in `tests/` mirror `src/` (`src/pipeline/salary.ts` → `tests/pipeline/salary.test.ts`).
- Coverage threshold is 80% (lines, branches, functions) on `src/`.
- Connector parsers are tested against saved HTML/JSON in `tests/fixtures/`, scrubbed of
  any real person's contact details. The privacy guard checks fixtures too.
- Labelled sets (eligibility, scams) live in `tests/fixtures/labelled/`.

## Definition of done (per task)

`npm run check` passes, the task's "Done when" is shown to the owner, the spec, plan and
README are updated if behaviour changed, and the task is ticked in `tasks.md`.

## Git

- Repo: `github.com/Hadia-i190404/Job-Hunter`. Identity is set in the repo's local git
  config to the owner's personal account. Never use a work identity here.
- Small commits with a clear message. One task per branch/PR once the repo has history.
