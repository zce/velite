# Error Handling

Velite's error model has three non-overlapping layers. Pick the right one before writing a `throw`.

## Three layers

| Layer           | Carrier                                            | When                                                                                             | Read by                                                                  |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Diagnostic data | `Diagnostic` (`src/core/errors.ts`)                | User content/config issues found during a build (schema validation, file load, asset processing) | Programmatic callers read `result.diagnostics`; the logger presents them |
| Build failure   | `VeliteError` with `diagnostics`                   | `build()`/`watch()` throws when diagnostics contain a fatal error                                | Caller `try/catch`                                                       |
| Internal assert | `VeliteError` (`code: 'internal'`, no diagnostics) | Programmer invariant violations that should never happen at runtime                              | Developers fixing bugs                                                   |

Principle: **diagnostics ≠ throws.** Collect user-facing issues as `Diagnostic`; only escalate to a thrown `VeliteError` when fatal (see `hasFatalDiagnostic`). Internal invariant violations are thrown directly via `fail()` and never enter the diagnostic channel.

## VeliteError API

```ts
type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown' | (string & {})

class VeliteError<T = unknown> extends Error {
  readonly code: VeliteErrorCode
  readonly context?: T
  readonly diagnostics: Diagnostic[]
  constructor(code: VeliteErrorCode, options?: { message?: string; context?: T; cause?: unknown; diagnostics?: Diagnostic[] })
}
```

`code` aligns with `DiagnosticStage` plus `internal` (invariant violations) and `unknown` (fallback). Reusing pipeline-stage vocabulary keeps thrown errors and diagnostic data in one namespace.

## fail / assert

```ts
fail('load', { message: `no loader found for '${path}'`, context: { path } })
fail('internal', 'session missing')
assert(currentSession != null, 'internal', 'session missing')
assert(loader != null, () => fail('load', { message: '...', context: { path } }))
```

- `fail(code, options?)` throws a `VeliteError` and never returns. Accepts a plain string as a `message` shorthand.
- `assert(condition, code, options?)` is an `asserts condition` guard with three overloads (string code, options object, or `() => never` thunk).

## Helpers

- `flattenError(error)` — normalize any thrown value to a string for logging (`VeliteError` → code, `Error` → message, object → JSON, fallback `'unknown'`).
- `isError` / `isVeliteError` — structural checks robust across bundle/realms.
- `codeFromDiagnostics(diagnostics)` — derive the thrown build-failure `code` from the first fatal diagnostic's `stage`.
- `defineErrorMap(map)` — register `code → default message` for fallback messaging.

## Decision tree

1. Is this a user content/config issue discovered during a build? → emit a `Diagnostic` (via `createDiagnostic`). Do not throw.
2. Is this an invariant that should never happen if the code is correct (missing session, loader not found for an internal call)? → `fail('internal', ...)` (or the matching stage code).
3. Did a build run produce fatal diagnostics? → throw `VeliteError(codeFromDiagnostics(diags), { message, diagnostics })` — only at the `build()`/`watch()` boundary.
4. Catching and re-logging an unknown error? → `flattenError(err)` to get a stable string.

## Anti-patterns

- Do not `fail()` a schema validation issue — collect it as a `Diagnostic` so callers see structured data and the build can continue collecting other issues.
- Do not bypass the diagnostic channel for user content errors; diagnostics are the build's result contract.
- Do not introduce a parallel error base class. `VeliteError` is the single base for all thrown velite errors.
- `BuildAborted` (`src/core/pipeline.ts`) is a control-flow signal, not an error — leave it outside the `VeliteError` hierarchy.
