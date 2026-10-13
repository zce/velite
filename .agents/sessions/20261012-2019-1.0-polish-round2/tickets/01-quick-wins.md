# 01 — Low-risk quick wins

Status: resolved

Small, independent fixes found in the round-1 audit. No shared files with later tickets.

## Outcome

- `classifyEvent(event, options)` → `createEventClassifier(options)` factory (`src/core/classify.ts`): option paths normalized once per batch (Set lookup for config paths, `under()` helper for prefixes); each event now pays exactly one `normalize` call instead of 5+.
- CLI `--debug` (`src/cli.ts`): prints the full stack via `console.error(err)` and always reaches `process.exit(1)` — no more relying on unhandled rejection (which previously skipped the exit call in debug mode).
- ADR 0002 status line annotated "(Implemented since: ... commit 11ec942)" matching ADR 0001's pattern.
- Removed round-1 build artifacts in `examples/basic/` (nothing tracked under `public/` or `.velite`).

Verified: `pnpm build` + 629/629 tests green.
