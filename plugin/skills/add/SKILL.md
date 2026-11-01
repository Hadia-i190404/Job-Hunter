---
description: Add a job to Job Hunter from a link or pasted job text - any site, including ones that block scripts like Rozee, LinkedIn or Indeed. Checks it like the daily hunt and adds it to today's list. Use when the user pastes a job link, forwards a job alert, or says "add this job".
allowed-tools: Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/add-job.ts *)
---

# Job Hunter: add a job

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/add-job.ts"
$RUN url <link>          # reads the job page's standard data
$RUN manual <job.json>   # when the page can't be read
```

1. **A link:** run `add-job.ts url <link>`.
   - `error: unreadable` (Rozee, LinkedIn and Indeed usually block reading): ask the
     user to paste the job text. Don't try to get around the site's block.
2. **Pasted text** (or after step 1 failed): pull out only what the text says: `url`
   (the link, or the job alert's link), `title`, `company`, `location` (with work mode
   if stated, e.g. "Lahore (Hybrid)"), `description` (the full text), `salaryText` if
   stated, and `source` (`rozee`, `linkedin`, `indeed`, `bayt`… from the link). Write
   it to `~/JobHunter/add-job.json`, then run `add-job.ts manual ~/JobHunter/add-job.json`.
3. Report in one line:
   - `added: true` → "Added: <title> at <company>, <fit> match. It's in today's list."
     Applications on Greenhouse, Lever or Ashby links are filled by Job Hunter at
     review; others come as an action card to apply yourself.
   - `added: false` → "Saved but not added: <reason>."

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
