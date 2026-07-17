# Discard schema effects collected by invalid records

Status: needs-triage
Origin: #399 (deleted from GitHub)
Created: 2026-07-16T02:25:17Z
Labels: bug

---

## Problem

The validate derivation appends schema effects directly to the source-level accumulator while a record is still being parsed. If another field makes that record fail validation, the entry is discarded but its asset and uniqueness effects remain.

Evidence: `src/core/pipeline/validate.ts` passes `collectEffect: e => effects.push(e)` into `runWithContext` before checking `parsed.success`.

## Expected behavior

Collect effects per record and merge them into the source result only when that record parses successfully, unless a future contract explicitly separates dependency discovery from committed effects.

## Impact

Invalid records can currently cause asset work or participate in cross-record uniqueness checks.

## Design context

The broader transaction and failure contract is being decided in [Define asset effects, diagnostics, and failure semantics](09-define-asset-effects-diagnostics-and-failure-semantics.md), part of [Design the 1.0 shared content derivation kernel](../map.md). This defect exists independently of the selected 1.0 architecture.
