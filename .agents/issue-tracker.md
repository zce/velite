# Issue tracker: Session-scoped Markdown

Development issues for this repo live inside session folders — there is no global tracker directory. The repo keeps conclusions only (code, `.adr/`, `.agents/knowledge/`); process artefacts live and die with sessions.

## Where issues live

- Tickets: `.agents/sessions/<session>/tickets/NN-<slug>.md`, numbered from `01` within the session — never a single combined tickets file
- The session's `spec.md` describes the task's scope when one exists
- `Status:` near the top of each ticket carries a triage role (see `triage-labels.md`), `claimed` while in progress, or `resolved` when done — exactly one status axis; a second axis (`Execution:` and friends) is forbidden
- Comments under a `## Comments` heading record decisions that change the ticket (scope changes, supersession), not progress

## Continuation across sessions

- A session folder is self-contained and append-only. Later sessions never edit earlier folders; earlier folders are frozen history.
- When a new session continues an unfinished task, it copies the still-open tickets (and the `spec.md`, if the work is unfinished) from the previous session's folder into its own.
- The live instance of any ticket exists in exactly one place: the session currently working on it.
- Long-running tasks may commit their session chain on the task's feature branch for review context; remove it before merging to `main`.

## Promotion, not persistence

When work lands, its durable conclusions move to `.adr/` and `.agents/knowledge/`; the session chain holds everything else and is never merged into `main`. Git history is the archive. Long-lived process documents drift — the codebase's current state is the single source of truth.

## GitHub Issues boundary

GitHub Issues on `zce/velite` belong to the community: feedback, bug reports, public tracking. Skills never create, read, label, or close them as part of development work. If a community issue becomes development work, create a session ticket with an `Origin: gh#NNN` line pointing back, and keep the GitHub issue focused on the community conversation.

## When a skill says "publish to the issue tracker"

Create a ticket file under `.agents/sessions/<current-session>/tickets/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket, both inside the session folder.

- **Map**: `<session>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `<session>/tickets/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research` / `prototype` / `grilling` / `task`); a `Status:` line records `claimed` / `resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan the current session's `tickets/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
- **Cross-session**: carry the map and unresolved children forward per the continuation rules above.
