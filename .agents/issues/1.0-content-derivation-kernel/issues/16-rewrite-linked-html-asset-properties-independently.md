# Rewrite linked HTML asset properties independently

Status: needs-triage
Origin: #403 (deleted from GitHub)
Created: 2026-07-16T02:25:18Z
Labels: bug

---

## Problem

`rehypeCopyLinkedFiles` records elements by URL, then rewrites every present `href`, `src`, and `poster` property on each recorded element. An element containing different relative URLs in multiple properties can have all properties overwritten with whichever processed URL completes last.

Example: `<video src="./video.mp4" poster="./poster.jpg">` can receive the same public URL for both properties. `Promise.all` makes the final value timing-dependent.

Evidence: `src/core/content/asset-links.ts` stores `Element[]` and loops over all `LINKED_PROPERTIES` during each URL replacement.

## Expected behavior

Track and rewrite each `{node, property}` occurrence independently. Each source URL must update only the property from which it was collected, with deterministic output regardless of async completion order.

## Design context

Plugin and effect semantics are being designed in [Define plugin execution and isolation semantics](06-define-plugin-execution-and-isolation-semantics.md) and [Define asset effects, diagnostics, and failure semantics](09-define-asset-effects-diagnostics-and-failure-semantics.md).
