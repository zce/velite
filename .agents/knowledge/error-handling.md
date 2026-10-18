# Error Handling

Velite's error model has three non-overlapping layers. Pick the right one before writing a `throw`.

## Three layers

| Layer           | Carrier                                            | When                                                                                             | Read by                                                                  |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Diagnostic data | `Diagnostic` (`src/core/diagnostic.ts`)            | User content/config issues found during a build (schema validation, file load, asset processing) | Programmatic callers read `result.diagnostics`; the logger presents them |
| Build failure   | `VeliteError` with `diagnostics`                   | `build()`/`watch()` throws when diagnostics contain a fatal error                                | Caller `try/catch`                                                       |
| Internal assert | `VeliteError` (`code: 'internal'`, no diagnostics) | Programmer invariant violations that should never happen at runtime                              | Developers fixing bugs                                                   |

Principle: **diagnostics ≠ throws.** Collect user-facing build issues as `Diagnostic`, with ordinary schema failures entering through Zod issues; only escalate to a thrown `VeliteError` at the applicable build policy boundary (see `hasFatalDiagnostic`). Internal invariant violations are thrown directly via `fail()` and never enter the diagnostic channel.

## Content stage failures

For content processing, recovery, or effect failure paths, read [ADR 0001](../../.adr/0001-share-semantic-content-results.md) and [ADR 0002](../../.adr/0002-content-definition-and-anchor-contract.md). These rules describe the implemented record-owned executions in `src/core/content/execution/`, not the superseded branch/seed path.

- Adapt ordinary content/plugin exceptions, invalid/conflicting explicit IDs, and failed processor stages into issues at each dependent requesting schema's normal Zod path. Retain the stage rejection without retry. Do not emit a second unconditional fatal diagnostic that defeats native `.catch()` recovery.
- Parse failure affects all selections; complete Transform failure affects navigation/generated content; Emit failure affects generated content only. Keep earlier successful semantic results, including source selections after Transform failure and navigation after Emit failure. MDX navigation stays provisional until recma and the entire Transform succeed.
- Shared warnings use record/content-execution provenance, never a first consumer's field. Repeated consumers do not duplicate them. Dynamic-heading capability warnings appear only when TOC is actually requested, including late requests. Preserve truthful message attribution; selected/transformed text without a source mapping gets no invented original-file coordinates.
- Failed-stage declarations are discarded; successful-stage declarations become eligible once. Eligibility is not commitment: invalid records discard every sibling effect, and existing cross-record/build policy still gates valid candidates. Direct plugin I/O is outside rollback.
- Directly throw `VeliteError('internal')` for internal invariants, recursive demands waiting on their own/ancestor pending work, missing/inactive leases, and use after close. Ordinary Zod fallback must not swallow those faults. Terminal close fences late settlement rather than reopening stages or journals.
- Observe abandoned native schema Promise rejections through the private runtime capability authorized by [ADR 0003](../../.adr/0003-observe-scoped-schema-promises.md), not a process rejection handler or a fallback conversion. Original outcomes and actual waiters remain unchanged; closing the lease still rejects late capability use.
- These rules replace branch-local failure/seed-compatibility assumptions only for content executions. They do not redefine unrelated diagnostic normalization, prepare, strict policy, or generation/publication contracts.

## VeliteError API

```ts
type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown'

class VeliteError<T = unknown> extends Error {
  readonly code: VeliteErrorCode
  readonly context?: T
  readonly diagnostics: Diagnostic[]
  constructor(code: VeliteErrorCode, options?: { message?: string; context?: T; cause?: unknown; diagnostics?: Diagnostic[] })
}
```

`code` aligns with `DiagnosticStage` plus `internal` (invariant violations) and `unknown` (fallback). Reusing pipeline-stage vocabulary keeps thrown errors and diagnostic data in one namespace.

## fail

```ts
fail('load', { message: `no loader found for '${path}'`, context: { path } })
fail('internal', 'session missing')
```

- `fail(code, options?)` throws a `VeliteError` and never returns. Accepts a plain string as a `message` shorthand.

## Helpers

- `isVeliteError` — structural check robust across bundle/realms.
- `hasFatalDiagnostic(diagnostics)` — an `error`-level diagnostic from any stage other than `schema` (schema errors are non-fatal by design).
- `codeFromDiagnostics(diagnostics)` — derive the thrown build-failure `code` from the first fatal diagnostic's `stage`.

## Decision tree

1. Is this an ordinary content-stage or schema failure? → add a field-local Zod issue; validation supplies the diagnostic boundary. Otherwise, a user content/config issue discovered during a build becomes a `Diagnostic` (via `diagnostic`). Do not misclassify it as an internal fault.
2. Is this an invariant that should never happen if the code is correct (missing session, loader not found for an internal call)? → `fail('internal', ...)` (or the matching stage code).
3. Did a build run produce fatal diagnostics? → throw `VeliteError(codeFromDiagnostics(diags), { message, diagnostics })` — only at the `build()`/`watch()` boundary.
4. Catching and re-logging an unknown error? → `flattenError(err)` to get a stable string.

## Anti-patterns

- Do not `fail()` a schema validation issue — collect it as a `Diagnostic` so callers see structured data and the build can continue collecting other issues.
- Do not bypass the diagnostic channel for user content errors; diagnostics are the build's result contract.
- Do not introduce a parallel error base class. `VeliteError` is the single base for all thrown velite errors.
