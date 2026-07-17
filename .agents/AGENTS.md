# `.agents/` — AI Workspace

This directory is the central hub for AI-related artefacts for this repository. It is **not** part of the shipped codebase.

## Three directories, three lifetimes

| Directory    | Purpose                                                    | Lifetime           | Tracked in git?     |
| ------------ | ---------------------------------------------------------- | ------------------ | ------------------- |
| `knowledge/` | Stable conventions every session (human + AI) must follow  | Long-lived, edited | **Yes**             |
| `issues/`    | Local issue tracker: feature specs + per-ticket files      | Long-lived         | **Yes**             |
| `sessions/`  | Transient session artefacts: plans, scratch notes, reports | Per-session        | **No** (gitignored) |

If a finding is universal and reusable → it belongs in `knowledge/`.
If it is "what we did this session" or "where we are right now" → it belongs in `sessions/`.
If it is a work item or spec that must survive across sessions → it belongs in `issues/`.

## Layout

```
.agents/
├── AGENTS.md                          ← this file
├── issue-tracker.md                   ← issue tracker config (local markdown)
├── triage-labels.md                   ← triage label mapping
├── domain.md                          ← domain doc consumer rules
├── knowledge/                         ← stable, long-lived AI conventions (tracked)
│   └── ...
├── issues/                            ← local issue tracker (tracked)
│   └── <feature-slug>/
│       ├── map.md
│       ├── spec.md
│       └── issues/NN-<slug>.md
└── sessions/                          ← transient per-session scratch (gitignored)
    ├── .gitignore                     ← ignores session subfolders, tracks AGENTS.md
    └── YYYYMMDD-HHmm-{slug}/         ← one folder per session
        ├── plan.md
        ├── notes.md
        ├── report.md
        └── ...
```

## Git policy

- `knowledge/` and `issues/` are **tracked** — commit them like any other source file.
- `sessions/.gitignore` ignores all session subfolders (`*/`). To commit a session on a feature branch for review context, add an un-ignore line (e.g. `!20260617-1430-schema-refactor`). Remove it before merging to `main`.
- Session folders must **never** be merged into `main`. Promote durable findings to `knowledge/` before cleanup.

## Knowledge directory

`knowledge/` holds conventions discovered during development that future sessions should follow. Each file should be short, factual, and named by topic.

These files are mandatory project guidance for future source changes, not optional reading. When a task touches architecture, module boundaries, runtime context, or error handling, read the relevant `knowledge/` file before editing source code or AGENTS guidance.

## Sessions directory

Transient scratch space for AI-assisted sessions: plans, research notes, status reports, and any artefact that helps a human or a future AI session pick up where the previous one left off. **Not** part of the codebase. **Not** for source code.

### Session folder naming

Format: `YYYYMMDD-HHmm-{slug}`

- `YYYYMMDD-HHmm` — local time when the session started.
- `{slug}` — short, lowercase, kebab-case description of the task. 2-5 words.
- Examples: `20260617-1430-schema-refactor`, `20260617-1500-fix-asset-dedup`.

If two sessions collide on the same minute, append `-2`, `-3`, etc. to the slug.

### When to create a new session vs. reuse an existing one

**Create a new session** when the user starts a new, unrelated task, or a previous session is finished (`report.md` written) and a follow-up has a different goal.

**Reuse the existing session** when the user says "continue", "keep going", "next step", or references the previous task, or the work is the same task spread across multiple conversations.

When unsure, list the most recent session folders (`ls -1t .agents/sessions/`) and ask.

### Files inside a session

All optional. Only create what the task actually needs.

| File         | Purpose                                                         |
| ------------ | --------------------------------------------------------------- |
| `plan.md`    | Goal, constraints, ordered steps, decisions still to make       |
| `notes.md`   | Findings, snippets, code references (`file:line`), observations |
| `report.md`  | Final summary when the task ends — what shipped, what didn't    |
| `todo.md`    | Outstanding actionable items, with owner if known               |
| `context.md` | Background a future session must know to make sense of the work |
| `logs.md`    | Verbatim command output / tool runs only when materially useful |

### Writing rules

1. Markdown only. No binaries, no screenshots unless the user provides them.
2. Bullet points and tables over prose. Aim for skimmable.
3. Reference source code with `path/to/file.ts:lineNumber`, never paste large source blocks.
4. Record decisions **and the reasoning** — future you will not remember why.
5. English only, matching the rest of the repo.
6. No secrets, tokens, passwords, or anything unsafe in a public gist.
7. Treat every session folder as ephemeral. If something must survive, promote it to `knowledge/`.

### Quality bar

A reviewer opening a session folder cold should, within ~2 minutes, answer:

- What was the goal?
- What is the current state?
- What changed in the actual codebase?
- What, if anything, is still pending?
