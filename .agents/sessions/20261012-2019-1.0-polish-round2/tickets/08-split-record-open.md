# 08 — Split `record.ts open()` into stage-lifecycle functions

Status: resolved

## Outcome

The 246-line closure monolith is now an explicit `RecordRun` state object + module-level stage-lifecycle functions, matching the repo's factory/state style. `open()` is a ~20-line composition.

- **`RecordRun`** — the per-record mutable state (definition caches, stage journals, active-stage routing, private wait graph, terminal/rejectClosed, closed flag) plus the factory deps (`markdown`/`mdx`), passed explicitly so every lifecycle function is module-level and independently navigable.
- Module-level functions: `resolveContentOptions` (pure options merge — the one truly pure piece, now testable), `invocationStage` / `active` (lease gates), `declareEffect` (journal routing), `obtainExecution` (definition/input caching + the asset-link `processAsset` closure), `runOwnedPhase` (the parse/transform/emit switch — extracted from the deepest nesting), `runStage` (stage memo + recursion guard + journal promotion), `trackWait` (wait graph), `demandContent` (one semantic demand), `collectWarnings` (CONTENT_WARNING diagnostics — nesting flattened with early-continue), `closeRecord` (teardown).
- `STAGE_RANK` hoisted to a module constant.
- New named types: `DefinitionCache`, `StageJournal`.
- All ordering semantics preserved (journal close fences, promotion-on-success-only, terminal race, wait-graph release) — verified by the 15 content-execution integration suites, which are the contract keepers.

Verified: `pnpm build` + 629/629 tests green.
