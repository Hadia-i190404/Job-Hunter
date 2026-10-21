---
description: Read the user's CV (PDF or Word) into their Job Hunter master profile, then make a clean ATS-friendly PDF from it and check it reads back correctly. Use when the user gives their CV, asks to update their profile from a CV, or asks for a clean CV.
allowed-tools: Read, Write(~/JobHunter/**), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/cv.ts *), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts init), Bash(sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts/store.ts status)
---

# Job Hunter: CV → profile → clean CV

The **master profile** is the only source of facts Job Hunter ever uses (spec R1, R5).
Getting it right matters more than getting it fast.

Scripts (each prints JSON):

```
RUN="sh ${CLAUDE_PLUGIN_ROOT}/scripts/run.sh ${CLAUDE_PLUGIN_ROOT}/scripts"
$RUN/store.ts status | init
$RUN/cv.ts docx-text <file.docx> | save-profile <draft.json> | render
```

Exit code 3 means Node.js is too old: tell the user to install the LTS from nodejs.org.

## Steps

1. **Paused?** Run `store.ts status`. If `paused` is true, say so and stop. If
   `setUp` is false, run `store.ts init` (it only creates what's missing).
2. **Get the CV.** Ask for the file path if the user hasn't given one.
   - `.pdf`: read it with the Read tool. A scanned PDF reads as images: still extract,
     but mark every field as needing confirmation.
   - `.docx`: run `cv.ts docx-text <path>`.
   - Anything else: ask for a PDF or Word file.
3. **Extract the profile** into JSON with exactly this shape:
   ```json
   {
     "name": "",
     "headline": "optional",
     "contact": { "email": "optional", "phone": "optional", "city": "optional", "links": [] },
     "summary": "",
     "experience": [
       {
         "id": "exp-1",
         "title": "",
         "company": "",
         "location": "optional",
         "start": "YYYY-MM",
         "end": "YYYY-MM or present",
         "bullets": [{ "id": "exp-1-b1", "text": "" }]
       }
     ],
     "education": [
       {
         "id": "edu-1",
         "degree": "",
         "institution": "",
         "start": "optional YYYY-MM",
         "end": "optional YYYY-MM",
         "details": "optional"
       }
     ],
     "skills": [{ "id": "skill-1", "name": "", "source": "cv" }],
     "certifications": [
       { "id": "cert-1", "name": "", "issuer": "optional", "year": 2024, "source": "cv" }
     ],
     "languages": [{ "name": "", "level": "optional" }],
     "projects": [
       {
         "id": "proj-1",
         "name": "",
         "description": "optional",
         "bullets": [{ "id": "proj-1-b1", "text": "", "source": "cv" }]
       }
     ]
   }
   ```
   Leave optional fields out rather than empty. Ids are lowercase, unique across the
   whole profile, and never reused for a different item later. Everything read from the
   CV gets `"source": "cv"`. **Never add anything the CV doesn't say**: something you
   think is missing or learned elsewhere (code, notes, LinkedIn) is a _draft_ for the
   user to approve in setup, never a profile entry (D16).
4. **Rules for extraction. These are not negotiable:**
   - **Copy facts, never improve them.** Keep numbers, titles, dates, employers and
     degrees exactly as written. Fix only obvious typos and spacing. Don't add skills
     the CV doesn't name, and don't merge or split roles.
   - **Leave these out** even if the CV has them (spec D8): photo, CNIC, father's name,
     date of birth, age, marital status, religion, gender, nationality, full home address
     (city is enough).
   - A date with only a year: use `YYYY-01` and list it for confirmation. A missing
     date: ask, don't guess.
   - An "objective" paragraph is not a summary. Use a real summary if there is one,
     otherwise leave `summary` as `""`.
5. **Save the draft** with Write to `~/JobHunter/profile.draft.json`, then run
   `cv.ts save-profile ~/JobHunter/profile.draft.json`. If it returns
   `invalid-profile`, fix the listed problems and save again.
6. **Show the user** what was captured: counts per section, every role as one line
   (title, company, dates), and **a list of anything you were unsure about**. Ask them to
   correct it. Apply their corrections the same way (edit the draft, save again).
7. **Make the clean CV:** run `cv.ts render`. Then **read the PDF back** with the Read
   tool and compare it with the profile: name, contact line, every role's title, company
   and dates, every bullet, education, skills. Report "reads back cleanly" or list
   exactly what's missing or garbled.
8. Tell the user where the PDF is. It's theirs to use as is. Tailored versions per job
   come later.

## Privacy

- Don't repeat CNIC, phone or address details back in chat, even when you mention that
  you dropped them. "Personal details like CNIC were left out" is enough.
- Everything stays in `~/JobHunter/`. Never write CV content anywhere else.
