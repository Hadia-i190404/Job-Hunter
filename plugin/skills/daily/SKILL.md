---
description: Job Hunter's unattended run, started by the scheduled tasks at 09:00, 13:00 and 18:00. Hunts, prepares the best applications, and notifies only when something is new. Use only for the scheduled runs or when the user says "run my daily job hunt".
allowed-tools: Read, Write(~/JobHunter/**), ToolSearch, PushNotification, WebSearch, Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/add-job.ts manual *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/tailor.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/apply.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts gap *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts status)
---

# Job Hunter: daily run (unattended)

This runs while nobody is watching, so:

- Never submit, message, fill a website form or ask a question. Only hunt and prepare.
- **Never open LinkedIn or any signed-in site.** LinkedIn mode (D24) is attended only,
  so there's no Claude in Chrome here.
- Never wait for input. If something needs the user, it goes on their review list.

The prompt says which run this is: `morning`, `midday` or `evening`.

## Steps

1. `store.ts status`: if `paused` is true, or `loop.searchesConfirmed` is false, stop
   **without** a notification.
2. Follow the `/job-hunter:hunt` skill's steps 1–4, including 3b (run, check unclear jobs
   within the budget, web search for the blocked sites, prepare the top matches with
   tailored CVs).
3. `apply.ts list`: count `waiting` applications (N) and their to-dos (M).
   `apply.ts pipeline`: count `followUpsDue` (F). Count the applications **this run
   prepared** (P).
4. **Notify only when it's worth it** (D25): on the `morning` run, if N > 0 or F > 0; on
   `midday` and `evening`, only if P > 0. Otherwise end quietly. Load the `PushNotification` tool with ToolSearch if needed, then send
   exactly one notification with `status: "proactive"`:
   - midday/evening with P > 0: `Job Hunter: P new applications ready. Run /job-hunter:review`
   - N > 0: `Job Hunter: N applications ready, M things need you. Run /job-hunter:review`
     (add ` · F follow-ups due` when F > 0)
   - N = 0 and F > 0: `Job Hunter: F follow-ups due. Run /job-hunter:review`
   - N = 0 and the hunt worked: `Job Hunter: no new matches today (X jobs checked)`
   - A source broken for the run: add ` · <source> unavailable` at the end.
     If the tool isn't available, end with that same line as your final message.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
