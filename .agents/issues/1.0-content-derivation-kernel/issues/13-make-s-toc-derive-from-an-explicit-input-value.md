# Make s.toc derive from an explicit input value

Status: needs-triage
GitHub: #400
Created: 2026-07-16T02:25:18Z
Labels: bug

---

## Problem

`s.toc()` accepts an explicit string input and checks that selected body for emptiness, but then always extracts headings from `context().file.mdast`. The result therefore describes the current file body instead of the explicit value. It can also fail with `No mdast tree available` when an explicit value exists but the file has no body.

Evidence: `src/core/schema/toc.ts` selects `value ?? file.content` but unconditionally reads `file.mdast`; `file.mdast` is created only from the file content in `src/core/schema/context.ts`.

## Expected behavior

When an explicit value is provided, derive the TOC from that value. Use the file-scoped cached parse only when no explicit value is provided.

## Design context

The long-term relationship between value transforms and file derivations is being decided in [Define the semantic invariants of shared content derivation](https://github.com/zce/velite/issues/390) and [Choose the public composition model for content derivations](https://github.com/zce/velite/issues/391). This issue records the current contract violation without prescribing the 1.0 public model.
