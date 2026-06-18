# Architecture Review 02: Important Fixes Recheck

## Scope

- Reviewed working tree after addressing Important findings from `architecture-review.md`.
- Focus areas: public/internal API boundary, resolver result assembly, `SessionStore`, watch config dependency reload, programmatic watch lifecycle, asset public API boundary, same-engine output recovery, and output null semantics.
- Verification commands were run after fixes:
  - `rtk pnpm build`
  - `rtk pnpm test`
  - `rtk pnpm docs:build`

## Result

No Critical or Important issues remain from the previous architecture review.

## Fixed Important Findings

1. Public `context()` no longer exposes `SessionStore`.

   References:
   - `src/core/context.ts:10-16`
   - `src/core/context.ts:46-56`
   - `src/core/context.ts:58-75`
   - `src/core/resolver.ts:37-42`
   - `src/schemas/file.ts:22-24`
   - `src/schemas/image.ts:36-39`
   - `src/schemas/markdown.ts:46-48`
   - `src/schemas/mdx.ts:26-28`
   - `src/schemas/unique.ts:17-18`
   - `test/schema.ts:46-55`

   Assessment:
   - Public `context()` returns only `{ config, file }`.
   - Built-in schemas use `internalContext()` for `store` access.
   - Core resolver uses `parseWithInternalContext()` to pass session state.

2. Resolver preserves falsy parsed results.

   References:
   - `src/core/resolver.ts:98-101`
   - `test/core-resolver.ts:201-228`

   Assessment:
   - Collection assembly now filters only `undefined`.
   - Regression test covers `0`, `false`, and `''` outputs.

3. `SessionStore` correctly caches `undefined` values.

   References:
   - `src/core/store.ts:42-50`
   - `test/core-store.ts:36-48`

   Assessment:
   - `SessionStore.get()` uses `Map.has()` to distinguish an absent key from a stored `undefined` value.

4. Watch config dependency matching is normalized.

   References:
   - `src/core/watch.ts:55-73`
   - `test/watch.ts:101-149`

   Assessment:
   - Watch events normalize with `resolve(root, filename)`.
   - Regression test modifies an imported config dependency (`settings.mjs`) and verifies config reload.

5. Programmatic watch has a closeable public API.

   References:
   - `src/index.ts:33-44`
   - `test/schema.ts:12-15`
   - `docs/reference/api.md:127-163`

   Assessment:
   - New `watch(options)` API builds once and returns a `Watcher` with `close()`.
   - `build()` keeps the existing return shape.

6. Asset helper/type public API boundary is explicit.

   References:
   - `src/index.ts:7-15`
   - `src/types.ts:1-328`
   - `docs/guide/migration.md:131-135`
   - `docs/guide/using-mdx.md:349-351`

   Assessment:
   - Root exports only stable asset-related public helpers/types: `Image`, `BlurOptions`, `getImageMetadata`, `isRelativePath`.
   - `AssetStore` / `AssetRecord` are no longer re-exported from public `types.ts`.
   - Migration docs explicitly mark low-level asset collection internals as non-public.
   - MDX bundling docs no longer reference internal linked-file plugin helpers.

7. Same-engine rebuild restores missing data and entry files.

   References:
   - `src/core/engine.ts:159-167`
   - `src/core/output.ts:29-41`
   - `test/output-recovery.ts:58-84`

   Assessment:
   - `rebuild()` now calls `writeEntry()` as well as data/assets output.
   - `emit()` checks file existence before skipping cached content.
   - Regression test deletes the data output directory after the initial build and verifies `items.json`, `index.js`, and `index.d.ts` are restored.

8. `writeData()` preserves `null` and skips only `undefined`.

   References:
   - `src/core/output.ts:87-98`
   - `test/core-output.ts:129-140`

   Assessment:
   - `null` remains a valid output value.
   - `undefined` remains the only skipped value.

## Residual Minor Risks

1. `build({ watch: true })` still starts a watcher without returning a close handle.

   References:
   - `src/index.ts:21-31`
   - `src/index.ts:33-44`

   Assessment:
   - This is no longer an Important API gap because a dedicated `watch()` API exists for programmatic callers.
   - It is still worth documenting `build({ watch: true })` as CLI/backward-compatible behavior and recommending `watch()` for programmatic use.

2. Watch lifecycle tests still use `build({ watch: true })` in some cases.

   References:
   - `test/watch.ts:35`
   - `test/watch.ts:73`
   - `test/watch.ts:129`

   Assessment:
   - Current tests pass and verify rebuild behavior.
   - Future hardening should add tests that call `watch()` directly and close the returned watcher in `finally`.

3. Integration fixture test still relies on output byte lengths.

   Reference:
   - `test/basic.ts:8-34`

   Assessment:
   - This predates the Important fixes and is not blocking.
   - Future cleanup should parse generated JSON and assert representative content instead of byte length.

## Verification Evidence

Latest verification results:

- `rtk pnpm build`: passed.
- `rtk pnpm test`: passed, 71 tests, 71 pass, 0 fail.
- `rtk pnpm docs:build`: passed.

Known existing build warning remains:

- `"Stats" is imported from external module "fs" but never used in "dist/chokidar-JNDIIBE4.js".`

## Final Assessment

The Important architecture issues identified in the first review have been addressed. The current state is substantially stronger: public API boundaries are clearer, session state remains internal, resolver/output semantics preserve valid falsy/null values, watch reload behavior has better path handling and coverage, and same-engine output recovery is protected by regression tests.

The remaining risks are Minor test/documentation hardening tasks, not blockers for the core architecture refactor.
