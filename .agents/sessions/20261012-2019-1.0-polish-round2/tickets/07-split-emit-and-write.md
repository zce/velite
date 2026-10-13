# 07 — Split `emitAndWrite` into phase functions

Status: resolved

## Outcome

Pure extraction, zero behavior change. `emitAndWrite` (was ~218 lines) is now ~60 lines of orchestration over three named phases plus shared plumbing:

- `AssetReadSession` — the mutable read state (bytes map + ASSET_FAILED read diagnostics) shared by the resolve and copy phases; `readAssetBytes` and `demandOf` became module-level helpers bound to it.
- `resolveAssets(context, emitted)` — pass-1 demand resolution, unresolved-input feeding, and the pass-2 re-emit decision (returns the possibly re-emitted result + the session).
- `runPrepareHook(context, output, diagnostics)` — the prepare-hook transaction; returns a discriminated `{ suppressed: true, result } | { suppressed: false, output, diagnostics }` so the suppression path (reconcile-to-empty + fatal gate + early BuildResult) lives with the hook it belongs to.
- `copyAssets(context, emitted, session)` — destination resolution via per-pair re-demand, byte reads for un-cached assets, writes; returns `{ written, desiredAssets, writeDiagnostics }`.
- `emitAndWrite` keeps only: pass-1 emit + logging, the diagnostic-count seam (early reads vs post-prepare reads), the fatal gate, `writeOutput` + manifest/cache updates, and asset reconciliation.

Verified: `pnpm build` + 629/629 tests green (image builds, watch, prepare-hook integration suites all pass — the extraction is behavior-neutral).
