# `.agents/sessions/` — AI Session Workspace

Transient scratch space for AI-assisted sessions: plans, research notes, status reports, and any artefact that helps a human or a future AI session pick up where the previous one left off.

**Not** part of the codebase. **Not** for source code.

---

## Git policy

`sessions/.gitignore` ignores all session subfolders by default — only `sessions/AGENTS.md` is tracked. Session subfolders are ignored so casual `git add .` never sweeps them up.

### Opting a session into a feature branch (recommended)

Session artefacts are valuable review context. To commit a session folder on a feature branch, add an un-ignore line to `sessions/.gitignore`:

```
!20260617-1430-schema-refactor
```

### Hard rule: do NOT merge session content into main

Before merging:

1. Remove the `!<session-folder>` un-ignore line from `sessions/.gitignore`.
2. `git rm -r --cached .agents/sessions/<session-folder>/` to drop from index.
3. Commit the cleanup, then merge.

If a session artefact has long-term value, **promote it** to `../knowledge/` (or another appropriate location) before the cleanup commit.

---

## Layout

```
.agents/sessions/
├── .gitignore                     ← this file: ignores session subfolders
├── AGENTS.md                      ← session folder rules & naming (this file)
└── YYYYMMDD-HHmm-{slug}/         ← one folder per session (gitignored)
    ├── plan.md
    ├── notes.md
    ├── report.md
    └── ...
```

---

## Session folder naming

Format: `YYYYMMDD-HHmm-{slug}`

- `YYYYMMDD-HHmm` — local time when the session started.
- `{slug}` — short, lowercase, kebab-case description of the task. 2-5 words.
- Examples:
  - `20260617-1430-schema-refactor`
  - `20260617-1500-fix-asset-dedup`
  - `20260618-0900-doc-cleanup`

If two sessions collide on the same minute, append `-2`, `-3`, etc. to the slug.

---

## When to create a new session vs. reuse an existing one

**Create a new session** when:

- The user starts a new, unrelated task.
- A previous session is finished (`report.md` written) and a follow-up has a different goal.

**Reuse the existing session** when:

- The user says "continue", "keep going", "next step", or references the previous task.
- The work is the same task spread across multiple conversations.
- An open `todo.md` or `plan.md` still has unfinished items relevant to the new turn.

When unsure, list the most recent session folders (`ls -1t .agents/sessions/`) and ask the user which to resume, or default to the most recent if it clearly matches.

---

## Files inside a session

All optional. Only create what the task actually needs.

| File         | Purpose                                                         |
| ------------ | --------------------------------------------------------------- |
| `plan.md`    | Goal, constraints, ordered steps, decisions still to make       |
| `notes.md`   | Findings, snippets, code references (`file:line`), observations |
| `report.md`  | Final summary when the task ends — what shipped, what didn't    |
| `todo.md`    | Outstanding actionable items, with owner if known               |
| `context.md` | Background a future session must know to make sense of the work |
| `logs.md`    | Verbatim command output / tool runs only when materially useful |

---

## Writing rules

1. Markdown only. No binaries, no screenshots unless the user provides them.
2. Bullet points and tables over prose. Aim for skimmable.
3. Reference source code with `path/to/file.ts:lineNumber`, never paste large source blocks.
4. Record decisions **and the reasoning** — future you will not remember why.
5. English only, matching the rest of the repo.
6. No secrets, tokens, passwords, or anything unsafe in a public gist.
7. Treat every session folder as ephemeral. If something must survive, promote it.

---

## Quality bar

A reviewer opening a session folder cold should, within ~2 minutes, answer:

- What was the goal?
- What is the current state?
- What changed in the actual codebase?
- What, if anything, is still pending?
