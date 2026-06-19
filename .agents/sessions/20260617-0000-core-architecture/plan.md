# Core Architecture Refactor — Implementation Plan

## Goal

Implement specs.md fully: refactor Velite core into session-isolated architecture with comprehensive test coverage. All phases (1-5) must complete with production-grade code.

## Baseline

- Branch: `refactor/core-architecture`
- Tests passing: 17/17
- `src/core/` exists but empty

## Phases

### Phase 1: Core skeleton

Create `src/core/` modules. No behavior change.

- `src/core/assets.ts` — `AssetStore`, `AssetRecord`
- `src/core/session.ts` — `BuildSession`, `FileCache`, `UniqueStore`, `OutputState`
- `src/core/config.ts` — `ConfigLoader` (wraps existing config logic)
- `src/core/output.ts` — `OutputWriter`
- `src/core/engine.ts` — `BuildEngine`

### Phase 2: Move state into BuildSession

- Add `assets` and `unique` to `ParserContext`
- `processAsset(...)` accepts `AssetStore` parameter
- `s.unique()` uses `context().unique`
- `s.file()`, `s.image()` use `context().assets`
- markdown/mdx schemas pass `AssetStore` to remark/rehype plugins
- `VeliteFile` static cache moves to `session.files`
- Rewire `build.ts` through `BuildEngine` + `BuildSession`
- Remove module-level globals: `loadedFiles`, `assets` Map, `uniqueCache`, `resolved`, `emitted`

### Phase 3: Split resolver/parser/output

- `src/core/discover.ts` — file discovery
- `src/core/load.ts` — file loading
- `src/core/parse.ts` — schema parsing
- Refactor `OutputWriter` to expose `writeEntry` + `writeDataAndAssets`
- Session-scoped logger

### Phase 4: Watch redesign

- `src/core/watch.ts` — `WatchController`
- Content change → `engine.rebuild()`
- Config change → `engine.build({ ...options, clean: false })`
- Engine exposes `engine.config`
- Add watch regression tests

### Phase 5: Unit tests

- Unit tests for AssetStore, UniqueStore, FileCache, OutputState
- Unit tests for ConfigLoader, OutputWriter, ContentResolver
- Keep fixture tests as integration tests

## Verification gates

After each phase:

- `pnpm build` — compiles cleanly
- `pnpm test` — all tests pass
- `pnpm docs:build` — final phase only

## Acceptance Criteria (from spec §408)

- [ ] No build-related module-level mutable globals
- [ ] Independent builds isolated by construction
- [ ] `AssetStore.add()` rejects same outputName + different sourcePath
- [ ] `ContentResolver` unit-testable with fakes
- [ ] `OutputWriter` unit-testable without fixture
- [ ] Watch config + content changes have regression coverage
- [ ] `build()` twice with deleted output dir → all JSON regenerated
- [ ] `pnpm build && pnpm test && pnpm docs:build` pass
- [ ] No `src/core/*` accidentally exported as public API
