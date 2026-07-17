# Preserve VFile path and state across MDX processing phases

Status: needs-triage
Origin: #404 (deleted from GitHub)
Created: 2026-07-16T02:25:18Z
Labels: bug

---

## Problem

`ProcessMdxOptions.path` is accepted and populated by `s.mdx()`, but `processMdx` does not pass a path-aware VFile through `parse`, `run`, and `stringify`. Manual phase calls create or use separate empty file values, so plugins cannot reliably communicate through `file.data` or `file.messages`, and path-dependent diagnostics or compilation behavior do not receive the declared source path.

Evidence: `src/core/schema/mdx.ts` sets `path: file.path`; `src/core/content/mdx.ts` calls `processor.parse(source)`, `processor.run(mdast)`, and `processor.stringify(estree)` without a shared VFile.

## Expected behavior

Either preserve one path-aware branch VFile across all supported phases or remove the ineffective option and use an officially supported MDX processing path with equivalent file semantics.

## Design context

The supported phase split is being evaluated in [Choose the shared processing and cache architecture](05-choose-the-shared-processing-and-cache-architecture.md) and [Define plugin execution and isolation semantics](06-define-plugin-execution-and-isolation-semantics.md). Research evidence is recorded in [Establish the safe reuse boundaries of Unified and MDX processors](01-establish-the-safe-reuse-boundaries-of-unified-and-mdx-proce.md).
