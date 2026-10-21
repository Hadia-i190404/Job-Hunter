---
description: Run Job Hunter's daily hunt now - search every job source for the user's confirmed targets, rank what fits, and check the jobs the rules weren't sure about. Use when the user says "find me jobs", "run the hunt", or for the scheduled daily run.
allowed-tools: Read, Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/tailor.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/apply.ts prepare *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts gap *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts status)
---

# Job Hunter: daily hunt

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts"
$RUN run | list [n] | job <jobId> | judge <jobId> <eligible|likely|not-eligible> <reason>
```

Exit code 3 = Node.js too old.

## Steps

1. Run `hunt.ts run`. It takes a minute or two (polite to every site).
   - `paused: true` → say "Job Hunter is paused" and stop.
   - `error: not-confirmed` → say setup isn't finished: run `/job-hunter:setup`. Stop.
2. **Check the unclear ones.** For items in `top` (then `list` if needed) with
   `needsClaude: true`, up to `claudeBudget` per run, best score first:
   - `hunt.ts job <jobId>` and read the description for where they hire from: countries,
     regions, time zones, "must be based in", payroll or contractor notes.
   - Decide **for someone living in Pakistan**: `eligible` (clearly open), `likely`
     (probably open), `not-eligible` (clearly closed). Record it with `hunt.ts judge` and
     a one-line reason quoting the deciding words. If it's still genuinely unclear, leave
     it: it stays marked for the user.
3. **Report** in a few lines: jobs seen, new, matched, strong fits, any source that was
   `broken` or `fallback` (one line each), then the top matches as a short list (title,
   company, where, fit, the main reason, link).
4. **Prepare the best ones** (D20): for the top `strong` and `good` items whose search
   is in `review` mode (up to 5 a day on the `light` usage setting, 10 on `full`):
   follow the `/job-hunter:tailor` skill to make a tailored CV, then run
   `apply.ts prepare <jobId> <pdf>`. Searches in `shortlist` mode are only listed.
5. End with one line for the notification: **"N applications ready, M things need you.
   Run /job-hunter:review."**

## Rules

- Never invent a verdict without reading the job. Quote the deciding words.
- Don't submit, message or fill anything on a website here. The hunt finds, ranks and
  prepares; submitting happens only in `/job-hunter:review`, with the user's approval.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here (e.g. "your first 5
applications will come one by one" is not a thing Job Hunter does). If the user asks
about something that isn't here, say it isn't built yet.
