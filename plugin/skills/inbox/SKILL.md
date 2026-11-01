---
description: Check the user's LinkedIn messages in their own signed-in Chrome for jobs friends sent, read each job, and add it to Job Hunter. Only when the user asks ("check my LinkedIn messages") or from the review they started. Never scheduled.
allowed-tools: Read, Write(~/JobHunter/**), ToolSearch, Skill, Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/add-job.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts status), mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__find, mcp__claude-in-chrome__computer
---

# Job Hunter: jobs from LinkedIn messages (attended, D24)

The user started this session and is present. You act **in their own Chrome**, where
they are signed in to LinkedIn (Claude in Chrome).

**Never** run this from a schedule or the unattended daily run. Work at a normal pace.
Don't speed up or add timing tricks. **Stop and hand over** at any CAPTCHA, "unusual
activity" notice, sign-in page, or warning from LinkedIn. Never get around one.
**Read only:** no replies, reactions or connection changes.

## Steps

1. `store.ts status`: if paused, say so and stop.
2. Load the `anthropic-skills:chrome-browser` skill, then the Claude in Chrome tools
   (one ToolSearch call). Open a **new tab** at `https://www.linkedin.com/messaging/`.
   Not signed in → ask the user to sign in, then continue.
3. Read the conversation list. Open conversations with activity in the **last 3 days**
   (or the period the user names), one at a time, and collect **job links** from
   messages: `linkedin.com/jobs/view/…`, `lnkd.in/…`, Greenhouse, Lever, Ashby, company
   careers pages and other job boards. Note who sent each one. Ignore everything else.
   Don't summarise private conversations, only the jobs.
4. For each job link:
   - Greenhouse, Lever, Ashby or another public page: `add-job.ts url <link>`.
   - LinkedIn job (or anything that needs sign-in): open it in the tab and read the
     page text: title, company, location (with work mode), the full description, and
     whether it shows **Easy Apply** or an external **Apply** link. If Apply leads to a
     Greenhouse, Lever or Ashby page, add **that** link with `add-job.ts url`.
     Otherwise write `{url: <https://www.linkedin.com/jobs/view/ID/>, title, company,
location, description, source: "linkedin"}` to `~/JobHunter/add-job.json` and run
     `add-job.ts manual ~/JobHunter/add-job.json`. Add "Easy Apply" to the start of the
     description if the page shows it.
5. Report in a few lines: N jobs found in messages, each one "<title> at <company>
   (from <friend>): added as <fit> / not added: <reason>". Added jobs get a tailored CV
   and an application through the hunt's prepare step or the review.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
