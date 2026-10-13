# Velite 1.0 Polish — Round 2 Report

Session: 2026-10-12 → 2026-10-13. Continues `../20261012-1110-1.0-polish/` (round 1: slop cleanup + docs truth pass, commit 9bfea38b2e). All 9 tickets resolved.

## Verification matrix (final)

- `pnpm build` ✓
- `node --import jiti/register --test 'test/**/*.tests.ts'` — 629/629 ✓ (after every ticket)
- `pnpm docs:build` ✓
- `npx tsc --noEmit` ✓
- Long-function scan: zero functions >80 lines in `driver.ts` / `record.ts` (was 218 + 246)
- Bench baseline (`pnpm bench:large`, 20k docs + 20k assets): full build 50.8s / no-op rebuild 1.47s / single-file incremental 204ms

## What shipped (per ticket)

1. **Quick wins** — `createEventClassifier` factory (per-batch normalization, Set lookups); CLI `--debug` prints the stack deterministically and always exits 1 (previously skipped `process.exit` via a rethrow-in-catch); ADR 0002 status annotation; example artifacts cleaned.
2. **Helper dedup** — shared `compareStrings` (`util/compare.ts`, 6 call sites), single `stringify` in `output/plan.ts`, `removeChildrenWhere` walker (`content/execution/tree-filter.ts`) unifying the three comment-removal plugins. Close-wrapper dedup deliberately skipped (shared mutable flag; recorded in ticket).
3. **Docs batch 2** — wrote real content for the four stub pages (how-it-works pipeline walkthrough, 13-entry FAQ, motivation, TypeScript guide); fixed nextjs example tree glyphs + stale date; zh-CN page got an honest "English-only for now" note; CI now runs `pnpm docs:build` on PRs (was main-branch deploy only).
4. **Test fork resolved by deletion** — `test:src` was silently broken as a "src-only" command (the jiti `velite → dist` alias makes 48 core/runtime tests dist-dependent). Deleted the script; moved the three directly-dist-importing suites to `test/dist/`; documented the real dependency story in AGENTS.md. Also documented that `--test-ignore` does not exist in Node (misleading probes during investigation).
5. **schema↔pipeline seam** — new `src/core/assets.ts` neutral module (asset identity types + `assetInput`/`assetKeyOf`/`publicUrlOf`); zero schema→pipeline imports remain; `diagnostic.ts` inline import-types converted to one type-only import.
6. **Phase 3 collectEffect migration (flagship)** — single two-arg declaration surface everywhere; deprecated `owner` fields and `publicUrl`/`resolved`/`isImage`/`assetPath` removed from committed effects (`{ assetKey, template, metadata, blur?, system }`); the driver now re-demands the asset derivation per effect key — which **fixed the pre-existing gap where declared-only assets passed the gate but were never copied**; emit reads `system.*` only; docs + knowledge synced.
7. **`emitAndWrite` split** — orchestration (~60 lines) over `resolveAssets` / `runPrepareHook` / `copyAssets` + a shared `AssetReadSession`. Behavior-neutral (all suites green).
8. **`record.ts open()` split** — explicit `RecordRun` state object + module-level lifecycle functions (`resolveContentOptions` pure, `runOwnedPhase`, `runStage`, `trackWait`, `demandContent`, `collectWarnings`, `closeRecord`); `open()` is now ~20 lines of composition.
9. **Bench + sweep** — this report; bench numbers recorded as the new baseline.

## Deliberately not done (unchanged from round 1)

- Custom-loader public registration (product decision, documented as the honest current state in `docs/guide/custom-loader.md`).
- The `entryPath()`/`typesPath()` zero-arg style nit and pool getters (test-covered contract surface).

## Handoff

- The session folder is un-ignored in `.agents/sessions/.gitignore` and should be committed with the work on this feature branch (remove the un-ignore line before merging to `main`, per `.agents/issue-tracker.md`).
- Nothing pending; if a round 3 happens, start from a fresh audit — the round-1 findings are all addressed or explicitly declined with reasons in the tickets.
