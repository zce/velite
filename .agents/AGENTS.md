# `.agents/` — AI Workspace

This directory is the central hub for AI-related artefacts for this repository. It is **not** part of the shipped codebase.

## Two directories, two purposes

| Directory    | Purpose                                                    | Lifetime           | Tracked in git?     |
| ------------ | ---------------------------------------------------------- | ------------------ | ------------------- |
| `knowledge/` | Stable conventions every session (human + AI) must follow  | Long-lived, edited | **Yes**             |
| `sessions/`  | Transient session artefacts: plans, scratch notes, reports | Per-session        | **No** (gitignored) |

If a finding is universal and reusable → it belongs in `knowledge/`.
If it is "what we did this session" or "where we are right now" → it belongs in `sessions/`.

## Layout

```
.agents/
├── AGENTS.md                          ← this file
├── knowledge/                         ← stable, long-lived AI conventions (tracked)
│   └── ...
└── sessions/                          ← transient per-session scratch (gitignored)
    ├── .gitignore                     ← ignores session subfolders, tracks AGENTS.md
    ├── AGENTS.md                      ← session folder rules & naming
    └── YYYYMMDD-HHmm-{slug}/         ← one folder per session
        ├── plan.md
        ├── notes.md
        ├── report.md
        └── ...
```

## Git policy

- `knowledge/` is **tracked** — commit conventions here like any other source file.
- `sessions/.gitignore` ignores all session subfolders (`*/`). To commit a session on a feature branch for review context, add an un-ignore line (e.g. `!20260617-1430-schema-refactor`). Remove it before merging to `main`.
- Session folders must **never** be merged into `main`. Promote durable findings to `knowledge/` before cleanup.

## When to create a session

**Create a new session** when the user starts a new, unrelated task or a previous session is finished.

**Reuse the existing session** when the user says "continue", "keep going", or the work spans multiple conversations on the same task.

When unsure, list recent sessions (`ls -1t sessions/`) and ask.

## Knowledge directory

`knowledge/` holds conventions discovered during development that future sessions should follow. Examples:

- Naming conventions specific to this repo
- Non-obvious build or test patterns
- Decisions with rationale that aren't obvious from the code

Each file should be short, factual, and named by topic (e.g. `schema-patterns.md`, `testing-notes.md`).
