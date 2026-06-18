# Architecture Review: Core Refactor

## Scope

- Reviewed commit range: `29dbb0ca5a170e2161d61e7c02a954f9788b5a77..1c15dbd41249e555f7455a6304335b28ff70923e`
- Reviewed areas: public entry/API boundary, `src/core/*` modularization, `BuildEngine`, `BuildSession`, `SessionStore`, `ParserContext`, config/watch/output behavior, and test coverage.
- Review posture: strict architecture review. Findings below prioritize defects, boundary leaks, and future-maintenance risks over style.

## Findings

### Critical

No Critical issue found that should block the branch immediately.

### Important

1. Public `context()` now exposes an internal `SessionStore`, which violates the intended core/internal boundary.

   References:
   - `src/index.ts:9`
   - `src/core/context.ts:19-26`
   - `src/core/context.ts:34-38`
   - `src/core/store.ts:8-24`

   Problem:
   - `context()` and `parseWithContext()` are still exported from the package root, but their public shape now includes `store: SessionStore`.
   - `SessionStore`, `StoreKey`, and `defineStoreKey()` are internal implementation concepts under `src/core/store.ts` and are not exported as a coherent public extension API.
   - This creates a half-public API: users can observe `context().store`, but cannot safely define stable keys without importing internal paths.
   - It also contradicts the architecture rule that `src/core/*` is internal unless deliberately surfaced through a stable facade.

   Suggested direction:
   - Split parser context into a public facade and an internal accessor.
   - Keep public `context()` returning only stable user-facing fields, likely `{ config, file }`.
   - Add an internal-only `internalContext()` or `parserContext()` used by built-in schemas to access `store`.
   - Alternative: explicitly promote `SessionStore`, `StoreKey`, and `defineStoreKey()` to a designed public extension API, document it, and export it from the root. This should be a deliberate product/API decision, not an accidental leak.

2. The resolver drops valid falsy parsed results.

   Reference:
   - `src/core/resolver.ts:98-110`

   Problem:
   - `files.flatMap(file => file.result).filter(Boolean)` removes `false`, `0`, and `''` from collection results.
   - Zod schemas can legitimately transform or parse records into falsy values.
   - This is a behavioral correctness bug in the new resolver assembly path, not just a test gap.
   - It is especially risky because the resolver now centralizes collection assembly; this line becomes the authoritative behavior for all collections.

   Suggested direction:
   - Replace `.filter(Boolean)` with a predicate that only removes `undefined`, or perhaps `undefined | null` if null should intentionally mean “skip”.
   - Add `ContentResolver` tests for `0`, `false`, and `''` outputs, including both array and `single` collections.

3. `SessionStore.get()` recreates values when a key factory returns `undefined`.

   Reference:
   - `src/core/store.ts:42-56`

   Problem:
   - The implementation reads `const existing = values.get(key.id)` and treats `existing !== undefined` as the cache-hit condition.
   - Because `StoreKey<T>` allows any `T`, `undefined` is a valid TypeScript value unless explicitly excluded.
   - A key whose factory returns `undefined` will be recreated every time even though `has(key)` returns true after the first call.
   - This weakens the generic store abstraction and can create surprising behavior for future schemas/plugins that use `undefined` as a sentinel state.

   Suggested direction:
   - Use `values.has(key.id)` to detect existence, then return `values.get(key.id) as T`.
   - Add a store unit test where `defineStoreKey('x', () => undefined)` is created once and `has()` remains consistent.
   - If `undefined` should not be supported, encode that constraint in the type and docs instead of relying on map semantics.

4. Watch config dependency matching is path-shape fragile and insufficiently covered.

   References:
   - `src/core/watch.ts:55-59`
   - `src/core/watch.ts:65-84`
   - `test/watch.ts:64-99`

   Problem:
   - The watcher watches both `'.'` with `cwd: root` and absolute `configImports`.
   - Event handling converts the event filename with `join(root, filename)` and then checks `configImports.includes(fullpath)`.
   - If chokidar emits an absolute path for an absolute watched import, `join(root, filename)` can produce the wrong path shape, so config import changes may not be detected.
   - The current test named “config dependency changes” only edits the main `velite.config.mjs`; it does not cover an imported config/helper file.

   Suggested direction:
   - Normalize event paths with a single rule, e.g. `resolve(root, filename)`, and compare against a normalized absolute `Set` of `configImports`.
   - Add a watch test where `velite.config.mjs` imports `./settings.mjs`, then modifying `settings.mjs` changes output behavior and triggers config reload.
   - Include at least one imported config dependency outside the content root if that is supported by `configImports`.

5. Programmatic watch lifecycle remains effectively unmanageable from the public API.

   References:
   - `src/index.ts:21-29`
   - `src/core/watch.ts:10-16`
   - `test/watch.ts:26-61`
   - `test/watch.ts:64-99`

   Problem:
   - `createWatchController().start()` returns a `Watcher`, but public `build({ watch: true })` discards it and still returns only `Record<string, unknown>`.
   - Programmatic callers cannot close the watcher started by `build({ watch: true })`.
   - Tests also cannot close the watcher directly; they only delete temporary directories and rely on process behavior.
   - The internal `Watcher.close()` design is good, but the public facade hides it, leaving lifecycle control inconsistent with the new architecture.

   Suggested direction:
   - Decide whether `watch` is CLI-only or programmatic.
   - If programmatic watch is supported, expose a stable handle or add a separate API such as `watch(options)` returning `{ result, close }`.
   - If public `build()` must preserve the current return type for 1.0, keep CLI watch on an internal path and consider rejecting/undocumenting `watch: true` for programmatic use.
   - Add tests around `WatchController` directly, including closing after config reload to ensure replacement watchers are closed.

6. Public asset helper exports were narrowed without an explicit compatibility decision.

   References:
   - `src/index.ts:7-13`
   - `src/core/assets.ts:168-214`
   - `src/core/assets.ts:242-281`
   - `package.json:22-25`

   Problem:
   - The previous root export exposed everything from `src/assets.ts`; the new root export exposes only `getImageMetadata` and `isRelativePath` plus asset-related types.
   - `processAsset`, `rehypeCopyLinkedFiles`, and `remarkCopyLinkedFiles` still exist but are no longer reachable through package exports.
   - Because `package.json` only exports the package root, users cannot migrate to a documented subpath import.
   - This may be acceptable for a 1.0 breaking cleanup, but it should be explicit. Otherwise it is an accidental API break caused by the internal move.

   Suggested direction:
   - Either restore selected public exports from `src/index.ts`, or document the removal in migration notes.
   - If these helpers are intentionally internal now, keep them non-public and remove public-facing type leaks that imply asset extension support.
   - If they are extension points, provide a coherent public facade rather than requiring `src/core/*` imports.

7. `src/types.ts` re-exports internal asset store types without a complete public asset extension API.

   Reference:
   - `src/types.ts:6-10`

   Problem:
   - `AssetRecord` and `AssetStore` are publicly exported from `types.ts`, but the functions that create or consume them (`createAssetStore`, `assetStoreKey`, `processAsset`, linked-file plugins) are internal or not exported from the root.
   - This exposes internal lifecycle concepts without giving users a stable way to use them.
   - It also makes later internal changes to `AssetStore` harder because the type is now part of the root declaration output.

   Suggested direction:
   - Remove `AssetRecord` / `AssetStore` from public type exports unless they appear in a public function signature.
   - If they are intentionally public, add a public asset extension story and document how custom schemas should interact with assets.

8. Output recovery is not covered for same-engine rebuilds.

   References:
   - `src/core/engine.ts:76-79`
   - `src/core/engine.ts:159-165`
   - `src/core/output.ts:28-35`
   - `test/output-recovery.ts`
   - `test/core-output.ts:101-126`

   Problem:
   - The engine intentionally shares `outputState` across rebuilds in the same engine/watch session.
   - `OutputWriter.emit()` skips writes when content matches cached output.
   - If a user deletes `.velite` during watch and then triggers a rebuild with unchanged content, data files can be skipped because `outputState.emitted` still says they were written.
   - The existing output recovery test covers two independent public `build()` calls, not `engine.rebuild()` or watch.

   Suggested direction:
   - Decide whether manual output deletion during watch should be supported.
   - If yes, `emit()` should check file existence before skipping, or engine should invalidate output state when output directories are missing.
   - If no, document this as a watch-mode limitation.
   - Add an engine-level test that deletes data output after `engine.build()` and calls `engine.rebuild()` with unchanged content.

### Minor

1. `test/basic.ts` still uses output byte lengths as integration assertions.

   Reference:
   - `test/basic.ts:8-34`

   Problem:
   - Byte-length assertions are brittle for formatting changes and weak against same-length behavioral regressions.
   - They do not validate collection shape, schema-derived fields, public entry importability, or asset URLs.

   Suggested direction:
   - Parse generated JSON and assert representative records and fields.
   - Dynamically import the generated `.velite/index.js` and assert export shape.
   - Keep a snapshot-like byte check only if there is a specific file-size contract, which does not appear to be the case.

2. `test/schema.ts` checks public context keys but not AsyncLocalStorage concurrency isolation.

   References:
   - `src/core/context.ts:40-65`
   - `test/schema.ts:41-50`

   Problem:
   - The key risk for `parseWithContext()` is context isolation across concurrent async parses.
   - The current test only confirms the current public keys.

   Suggested direction:
   - Add a concurrent parse test where two parses with different `file.path` values interleave through async transforms and assert each sees its own context.

3. `ContentResolver` single-collection edge cases are under-tested.

   References:
   - `src/core/resolver.ts:102-106`
   - `test/core-resolver.ts`

   Problem:
   - There is coverage for the normal single-record case, but not for zero records or multiple records.
   - These branches encode public collection semantics (`single: true`) and should be protected during architecture refactors.

   Suggested direction:
   - Add tests for empty `single` result throwing and multi-record `single` result selecting the first record while warning.

4. Config reload tests do not verify stale import-cache avoidance.

   References:
   - `src/core/config.ts:150-154`
   - `test/core-config.ts:121-145`

   Problem:
   - `ConfigLoader` appends a query parameter to avoid ESM import caching.
   - The reuse test only compares stable path/import counts; it does not prove that changed config contents are reloaded by the same loader instance.

   Suggested direction:
   - Load a config returning output A, modify the config or an imported helper to output B, then load with the same `ConfigLoader` and assert B is observed.

## Positive Architectural Notes

- The flat `src/core/` layout is a clear improvement over the previous root-level script structure.
- `BuildSession` now provides a concrete ownership boundary for per-build mutable state.
- `SessionStore` is the right direction for preventing schema-specific fields from accumulating in `ParserContext`.
- `ConfigLoader`, `ContentResolver`, `OutputWriter`, and `WatchController` are independently testable units, which improves maintainability.
- The new unit tests significantly improve coverage of asset deduplication, config loading, output writing, session isolation, and watcher behavior.

## Recommended Fix Order

1. Fix `ContentResolver` falsy output handling and add tests for `0`, `false`, and `''`.
2. Fix `SessionStore.get()` to use `Map.has()` and add an `undefined` value test.
3. Resolve the public `context().store` API boundary: either split public/internal context or formalize `SessionStore` as public API.
4. Clarify asset helper/type public API: restore exports or document intentional removal.
5. Harden watch config dependency path matching and add imported-config watch coverage.
6. Decide and document programmatic watch lifecycle behavior; expose/deny a close handle accordingly.
7. Replace byte-length fixture assertions with content-level assertions.

## Final Assessment

The refactor is directionally sound and substantially improves internal testability, but it is not yet architecturally sealed. The main remaining risk is not module layout; it is API boundary clarity. `SessionStore` solved the schema-specific context problem internally, but exporting `context()` now leaks that internal mechanism. The second class of issues is behavioral correctness in the new centralized resolver/watch paths, especially falsy outputs and config dependency events.

Treat this branch as a strong foundation that needs one hardening pass before merge or release.
