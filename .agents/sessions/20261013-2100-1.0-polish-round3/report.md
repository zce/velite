# 1.0 Polish — Round 3 Report

Session: 2026-10-13 → 2026-10-14. Continues rounds 1–2 (`../20261012-1110-1.0-polish/`, `../20261012-2019-1.0-polish-round2/`). Round 3 started from a fresh audit (three parallel code/doc audit passes), as round 2's handoff prescribed.

## Verification matrix (final)

- `pnpm build` ✓
- `node --import jiti/register --test 'test/**/*.tests.ts'` — **636/636** ✓ (baseline 629 → +7 new tests)
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` ✓ (zero unused symbols repo-wide)
- `pnpm docs:build` ✓ (no dead links)
- Prettier clean on all touched files
- Bench (`pnpm bench:large`, 20k docs + 20k assets): full build 50.4s / no-op rebuild 1.50s / single-file incremental 211ms — matches the round 2 baseline (50.8s / 1.47s / 204ms); first bench run showed 58s but a rerun confirmed machine-load variance.

## Fixed — process-level crashes (both real, both verified by reading the full call chain)

1. **Watch mode died on broken content.** `createScheduler` fires `void drain()`; a rejected rebuild (fatal `LOADER_FAILED` on a broken YAML/JSON edit) escaped as an unhandled rejection and killed `velite dev`. The builder's scheduler wiring now catches, logs via the injected logger, and keeps watching. Regression test: `test/watch-resilience.tests.ts` (break file → error logged → fix file → clean rebuild).
2. **Failed source read crashed the build.** `readSources` pushed `pool.run(...)` promises into a dead `tasks` array and awaited `pool.drain()`, which waits for settlement but drops rejections — a file vanishing between walk and read (or a permission error) became an unhandled rejection instead of the structured error path. Now `await Promise.all(tasks)` (propagates the first failure; handlers stay attached to all in-flight tasks).

## Fixed — correctness / robustness

3. **Empty single collection + prepare data produced a broken Entry.** `rebuildOutput` spread `result.entries[0]!` — with zero entries and a prepare-supplied object this yielded an Entry with missing `id`/`source` that flowed into the writer. Now synthesizes an entry the same way the list branch does.
4. **`Builder.clean()`/`dispose()` bypassed the mutex** they exist to protect (`manifest`/`assetManifest`, watch-state setup races). Both now run through `serialize()`.
5. **`tryPatchEmitted` bailed on ANY remembered diagnostic** — one markdown warning permanently disabled incremental patching for the session. Patches now carry prior diagnostics forward, drop the ones owned by re-validated sources, and abort only on error-level validation failures (matching what a full rebuild reports). Contract test in `test/incremental.tests.ts`.
6. **Fatal-gate `VeliteError` had an empty message** — the CLI printed a blank line after the diagnostic report (`velite build` on broken content). New `throwIfFatal` helper derives code AND message from the first fatal diagnostic; also deduplicated the gate and the `firstFatalDiagnostic` predicate (was written 3×).
7. **`emit()`/`transform()` before parse or after release** in `processor.ts` threw raw `TypeError`s instead of the module's clean `fail('internal')` — guard gap closed with `ready()`.
8. **Frontmatter shape unvalidated** — scalar/sequence YAML frontmatter (`--- 42 ---`, `--- - a ---`) spread into numeric-keyed objects and surfaced as baffling schema errors. Now a clean `LOADER_FAILED`.
9. **`VeliteError.toString()` could throw** (circular context via `JSON.stringify`, hostile cause `toString`) and silently dropped falsy contexts. Rendering now goes through a never-throwing `renderValue` (normalizer fallback). Also closed the revoked-Proxy prototype gap in `normalizeDiagnosticValue` — the module's "Total: never throws" contract now holds.
10. **Digest scheme mismatch in the single layout**: full builds stamped `hash(content)` while patches stamped `collectionDigest(entryDigests)` — a full build followed by a content-unchanged patch rewrote identical bytes (and falsely reported them as `written`). Full path now uses the same entry-digest scheme and fills the entry JSON cache through the shared `buildListCollectionJson` (also deduplicating the cache-fill loop). File bytes are unchanged in every case; only manifest digests unified.
11. **Vite plugin `buildStart` never set its `started` flag** — `vite build --watch` re-ran a full velite build on every rollup pass.
12. **`velite <unknown-command>` silently ran a build.** Now exits 1 with a hint.

## Perf / hot-path

- `asset` derivation hashed every `s.file()` asset's bytes **twice** (public url computed, then recomputed inside `resolvedFile`). Hashed once now.
- `validate` derivation rebuilt `ProjectInfo`, the probe closure, and did 2 linear collection scans **per source**. Hoisted to factory level (`collectionMeta` Map).
- Scheduler state machine simplified (half-dead `scheduled` flag → honest `timer`/`microtask` flags).

## Slop cleanup

- Removed 5 unused imports/params (compiler-verified), the empty `schema/derivation/` dir, and the `src/core/engine/*.ts` first-line path comments.
- Comment drift fixed in: `pipeline/asset.ts` (placeholder/disk-backstop flow + docstring attached to the wrong function), `engine/engine.ts` (stale M1/M2 plan references), `output/{plan,layout,declaration}.ts` + `content/asset-links.ts` ("Ported from" archaeology), `DiagnosticSourceProvenance`/`SourcePath` ("project-relative" → content-root-relative), scheduler `mergeEvents` ("consecutive" → dedup-by-path).
- Type honesty: `freeze<T>` re-typed to `DiagnosticValue` (killed two `as unknown as`), `asset-links.ts` remark plugin uses one structural cast helper instead of four double casts, mdx.ts dropped a redundant `NavigationNode` cast, `loaderFailure` uses the repo `instanceof Error` idiom, public `MarkdownDefinitionOptions`/`MdxDefinitionOptions` are type aliases (not phantom empty interfaces), internal `ContentOptions` alias removed.
- `DiagnosticStage`/`DiagnosticLevel` now derive from the rank arrays (single source of truth — a stage missing its rank entry is a compile error).
- Structure: `writeOutput` split into `patchSingleLayout`/`patchSplitLayout`/`reconcileFull` (101→~40-line dispatcher); `validate` compute extracted `createEffectCollector`/`schemaInvalidDiagnostics`/`effectSystemOwner` (113→70 lines).
- Deliberately kept: `configured as unknown as ContentProcessor` (single documented dependency-boundary correction — an adapter would add 4+ scattered casts), `rel.startsWith('..')` guard in `applyChanges` (cheap corruption guard against normalize/relative disagreement), `event.type === 'change'` short-circuit (skips wasted patch attempts), `issue.path as (string | number)[]` (zod boundary).

## Public API

- Exported `EffectSystemOwner` and `EffectRequestProvenance` — both already leaked structurally through the exported `Effect` type but couldn't be imported by name.
- CLI: unknown commands rejected; `--strict` help text broadened to the real contract (any error-level diagnostic).
- Builder docs added (`builder()` section in `docs/reference/api.md` incl. `BuildOptions`/`WatchOptions`/`onRebuild`), watch initial build now logs `building... / build finished` like a normal build.

## Docs truth pass (16 findings from a fresh full-docs audit)

Hard errors (docs described non-existent behavior): `CollectionResult` documented a conditional type that doesn't exist (real: `{collection, mode, entries}`); `s.isoDate()` claimed to produce `Date` (produces ISO string); migration guide showed the deprecated single-arg `collectEffect`.

Completed the type reference: added `Diagnostic`, `BlurOptions`, `LogicalOutput`, `Entry`, `StableOccurrence`, `EffectSystemOwner`, `EffectRequestProvenance` sections; fixed `AssetResult.resolved`, `AssetRequest.metadata`, `ContentFile.id` scope; `Effect` now shows the real `request?`/`blur: BlurOptions` fields.

Config/CLI: `-c, --config` default corrected (auto-discovery of 6 extensions, 3 parent dirs — was "velite.config.js"); `--watch` documented as a build flag; same fixes in `docs/reference/config.md`.

Plugins: Next/Vite readmes + `with-nextjs.md` no longer claim an "except `watch`" that doesn't exist (`BuildEntryOptions` has no `watch`); the Vite readme now warns `clean: true` applies on dev-server start too; dead emoji anchor fixed.

Misc: stale "documentation incomplete" banners replaced with an honest alpha note; `examples/basic.md` tree fixed (`journal.webp`, excluded dir); README gained a Requirements section (Node ≥22.13.0, ESM-only).

## New tests (+7)

`watch-resilience.tests.ts` (failed-rebuild survival), `scheduler.tests.ts` (4 direct scheduler contract tests — previously untested), incremental patch carry/drop contract, `toString` hostile-input rendering.
