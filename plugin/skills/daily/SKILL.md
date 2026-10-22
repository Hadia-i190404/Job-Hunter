---
description: Job Hunter's unattended daily run, started by the 09:00 scheduled task. Hunts, prepares the best applications, then sends one desktop notification. Use only for the scheduled run or when the user says "run my daily job hunt".
allowed-tools: Read, Write(~/JobHunter/**), ToolSearch, PushNotification, Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/tailor.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/apply.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts gap *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts status)
---

# Job Hunter: daily run (unattended)

This runs while the user is away. **Nobody is watching**, so:

- Never submit, message, fill a website form or ask a question. Only hunt and prepare.
- Never wait for input. If something needs the user, it goes on their review list.

## Steps

1. `store.ts status`: if `paused` is true, or `loop.searchesConfirmed` is false, stop
   **without** a notification.
2. Follow the `/job-hunter:hunt` skill's steps 1–4 (run, check unclear jobs within the
   budget, prepare the top matches with tailored CVs).
3. `apply.ts list`: count `waiting` applications (N) and their to-dos (M).
4. **Notify once.** Load the `PushNotification` tool with ToolSearch if needed, then send
   exactly one notification with `status: "proactive"`:
   - N > 0: `Job Hunter: N applications ready, M things need you. Run /job-hunter:review`
   - N = 0 and the hunt worked: `Job Hunter: no new matches today (X jobs checked)`
   - A source broken for the run: add ` · <source> unavailable` at the end.
     If the tool isn't available, end with that same line as your final message.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
