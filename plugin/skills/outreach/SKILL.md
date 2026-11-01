---
description: Find who is hiring for the user's applications and draft short, specific messages for the user to send themselves (LinkedIn note, message or email), with one follow-up at most. Use after applying, when the user asks to reach out to the hiring team, or from the daily review.
allowed-tools: Read, Write(~/JobHunter/**), ToolSearch, WebSearch, Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/outreach.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/apply.ts list), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/apply.ts show *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/hunt.ts job *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/setup.ts show)
---

# Job Hunter: hiring-team messages

**The user sends every message themselves** (D3). Job Hunter never logs in to LinkedIn
or sends email. It finds people from public sources and drafts the words.

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts"
$RUN/outreach.ts save <file> | list | mark <id> <sent|replied|skipped> | followed-up <id>
$RUN/apply.ts list | show <id>      $RUN/hunt.ts job <jobId>      $RUN/setup.ts show
```

## 1. Who's hiring (for submitted or approved applications, strongest fits first)

Look in this order and stop when you have one or two good people per company:

1. **The job post** (`hunt.ts job <jobId>`): a named recruiter or hiring manager →
   `confidence: posted-the-job`, `source: job-post`.
2. **The user**: they can paste names from LinkedIn's "Meet the hiring team" on the job
   page → `source: user`, `confidence: posted-the-job`.
3. **Web search** (WebSearch; up to 4 searches a run): `site:linkedin.com/in "<company>"
(recruiter OR "talent acquisition")` and `site:linkedin.com/in "<company>"
"engineering manager" <team or stack>` → `source: web-search`, `confidence:
recruiter` or `likely-manager`. Use the result's title and snippet only. Don't open
   profiles. A company team page found the same way → `source: team-page`.
   Never guess a name or an email address. No person found → no message.

## 2. Draft one message per person

- **One message per person**, even if they hire for several of the user's jobs. Mention
  each role.
- **Channel:** `linkedin-note` (connection request, **≤ 300 characters**, enforced),
  `linkedin-message` if already connected, `email` only if the job post gives a work
  address.
- **Content:** the specific role (and that they applied, with the date), one real,
  relevant fact from the master profile that fits the role, and a light question or
  offer ("happy to share more about…"). No flattery, no generic templates, no client
  names (D17), no figures the profile doesn't have.
- Write `[{id, name, role, company, url, confidence, source, jobIds, channel, message}]`
  to `~/JobHunter/outreach-draft.json` (ids like `contact-1`), then
  `outreach.ts save ~/JobHunter/outreach-draft.json`.

## 3. Show the cards

For each drafted contact, show: **name, role, company** (with the link if any), the
confidence in plain words ("posted this job" / "recruiter there" / "probably the
manager"), and the message in its own fenced code block so it has a copy button. The
user sends it and says "sent", replies arrive and they say "replied", or they skip it:
`outreach.ts mark <id> sent|replied|skipped`.

## 4. One follow-up

`outreach.ts list` → `followUpsDue` (sent, no reply after the follow-up wait). Offer
**one** short, polite follow-up per person. After the user sends it:
`outreach.ts followed-up <id>`. Never a second one. Stop as soon as someone replies.

## Say only what Job Hunter does

Describe only what these instructions and the scripts actually do. Never promise a
feature, schedule, limit or behaviour that isn't written here. If the user asks about
something that isn't here, say it isn't built yet.
