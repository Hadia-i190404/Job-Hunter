---
description: Show Job Hunter's status (set up or not, paused or not, which data files exist) and pause or resume it. Use when the user asks "what's waiting for me?", "job hunter status", "pause job hunter", "resume job hunter", or similar.
allowed-tools: Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts *)
---

# Job Hunter: status

Report plainly, in a few short lines. Never show file contents, only what the command
returns.

## Commands

All data-folder access goes through one command, which prints JSON:

```
sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts <command>
```

| User wants        | `<command>` |
| ----------------- | ----------- |
| status (default)  | `status`    |
| pause Job Hunter  | `pause`     |
| resume Job Hunter | `resume`    |

Don't run `init`. Creating the data folder is setup's job.

## Reading the result

- **Exit code 3** (no JSON; the message says "needs Node.js 22.18 or newer"): tell the
  user to install the LTS version from https://nodejs.org/, then stop.
- **`"setUp": false`**, or **`"error": "not-set-up"`**: say
  > Job Hunter isn't set up yet. Setup (`/job-hunter:setup`) is coming in the next
  > update. It will read your CV, ask what you're looking for, and create your data
  > folder.
- **`"error": "plugin-too-old"`**: the data folder was made by a newer Job Hunter. Tell
  the user to update the plugin (README, "Getting updates").
- **Set up**: report
  - **Paused or running.** If paused, add: say "resume job hunter" to restart it.
  - Which of these exist: profile, searches, answers, jobs, cards, pipeline (from
    `files`). Missing ones are normal before those features exist.
  - Anything in `problems`, word for word. Say the file may be damaged and that Job
    Hunter kept a copy. Don't try to fix it.
- **Pause / resume**: confirm in one line ("Job Hunter is paused.").
- Any other `error`: show it and stop.

## Rules

- Read-only except for `pause` and `resume`, and only when the user asked for them.
- Never read `profile.json` or `answers.json` yourself. They hold personal data.
