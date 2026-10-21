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
- After each task, report the result to the owner (what changed, how it was verified,
  anything they need to try), then go straight on to the next task. Don't wait for a
  go-ahead (owner's preference, 21 Oct 2026). Do stop when a task needs the owner: their
  CV, their account, a decision, or a test only they can run.
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

- **Node 22.18+**, **TypeScript** (strict), run directly by Node's built-in type
  stripping. No build step and no `tsx`. Write only erasable syntax (no `enum`, no
  `namespace`, no parameter properties); `erasableSyntaxOnly` enforces it.
- **The plugin has zero runtime dependencies** (spec D14). Plugin code imports only
  `node:` built-ins and local files, and lint enforces it. The reason: when a user
  installs or updates the plugin, Claude Code installs everything in a `package.json`
  it finds there, which first time round was 131 MB of dev tools. Validation is
  hand-written (`plugin/src/schema/`, from T3), not zod.
- **Dev tooling** (repo root only, never shipped): Vitest, ESLint (typescript-eslint,
  type-aware), Prettier, Knip, TypeScript.
- **Claude Code plugin:** the repo is the marketplace (`.claude-plugin/marketplace.json`,
  `"source": "./plugin"`). The plugin is the `plugin/` folder, and only that folder is
  installed on users' machines. **No `version` field**: each commit on `main` counts
  as an update (spec D10). `npm run plugin:validate` checks both manifests and every
  skill. The "no version" warning is expected.
- **Skills say only what Job Hunter does.** Each SKILL.md ends with the "Say only what
  Job Hunter does" rule, and user-facing wrap-up lines are written out word for word. A
  session once promised "your first 5 applications will come one by one", which nothing
  implements (22 Oct). Keep the rule in every new skill.
- **Skills** live in `plugin/skills/<name>/SKILL.md` and become `/job-hunter:<name>`. Each
  needs a `description` that says when to use it, and an `allowed-tools` list kept as
  narrow as the skill needs. Bundled scripts are referenced as
  `${CLAUDE_PLUGIN_ROOT}/scripts/…`.

## Structure

```
.claude-plugin/marketplace.json   marketplace → ./plugin
plugin/                           everything users install (nothing else ships)
  .claude-plugin/plugin.json
  skills/<name>/SKILL.md          one per slash command: status, setup, hunt, tailor, …
  src/
    schema/                       hand-written validators for every data file
    store/                        the ~/JobHunter/ data folder: read/write, migrations
    connectors/                   one file per platform + generic.ts; all implement `Connector`
    pipeline/                     normalise, dedup, salary, location, eligibility/scam rules
    cv/                           render HTML→PDF, ATS checks
    dashboard/                    localhost dashboard
  scripts/                        CLI entry points the skills run (console output allowed)
  templates/                      ATS-safe CV / cover letter HTML
  shared/                         group-shared data, no personal data (D13)
tools/                            dev-only tools (privacy guard); never shipped
tests/                            mirrors plugin/src and tools; fixtures/ = fake/scrubbed only
specs/                            spec → plan → tasks
```

## Data folder access

- Skills never read or write data files directly. They run plugin scripts through
  the launcher, which finds a Node ≥ 22.18 even if the user's default `node` is older:
  `sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/<script>.ts …`.
  Scripts print one JSON object and exit non-zero on error (3 = no suitable Node).
- All file I/O goes through `plugin/src/store/`: `writeJsonAtomic`/`readJson` (atomic,
  `.bak` recovery), `appendJsonLine`/`readJsonLines` (streamed), `logEvent`, settings.
- Changing a file's shape means bumping `CURRENT_SCHEMA_VERSION` and appending a
  migration to `MIGRATIONS`. Never edit a released migration.
- Tests use a temp folder (`tests/store/helpers.ts`) or `JOB_HUNTER_HOME`, never the real
  `~/JobHunter/`.

## Code conventions

- **Small units.** Lint enforces: complexity ≤ 12, nesting ≤ 4, ≤ 4 params, ≤ 80 lines per
  function, ≤ 300 lines per file. If you hit a limit, split the code. Don't disable the rule.
- **Pure core, thin edges.** `pipeline/`, `schema/`, the CV logic and `tools/privacy/`
  are pure functions (data in, data out) and fully unit tested. I/O lives in `store/`,
  `connectors/` and `scripts/`.
- **Types:** no `any`, no non-null `!`. Parse unknown data with the `schema/` validators. Exported functions
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
  (`no-await-in-loop` is on. Disable it only for work that must be sequential, such as
  per-host pacing or migrations, and say why in a comment.)
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
npm run report:eligibility  # rule accuracy on tests/fixtures/labelled/eligibility.json
```

The **pre-commit hook** runs privacy guard (staged files), typecheck, lint, format check
and tests. **CI** (GitHub Actions) runs `npm run check` on every push and PR.

## Testing

- Tests in `tests/` mirror the code (`plugin/src/pipeline/salary.ts` →
  `tests/pipeline/salary.test.ts`; `tools/privacy/guard.ts` → `tests/tools/…`).
- Coverage threshold is 80% (lines, branches, functions) on `plugin/src/` and
  `tools/privacy/`.
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
