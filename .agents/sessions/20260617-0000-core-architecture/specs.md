# Core Architecture Design

## Status

Draft approved for planning. This document defines the desired internal architecture for Velite 1.0 core refactoring.

## Context

Velite started as a small content build utility. The current implementation still works, but the core build flow has outgrown its original script-like structure. Several responsibilities are currently coupled inside `src/build.ts`, and mutable build state is distributed across module-level globals such as loaded files, resolved collections, assets, emitted output cache, and unique value cache.

This makes the system harder to reason about and hard to unit test. Many tests must run real fixture builds through the package entry instead of testing isolated behavior. Watch mode is especially sensitive because partial rebuild state can become stale when assets, loaded files, config dependencies, or output caches are reused incorrectly.

The goal of this design is to introduce clear internal architecture boundaries before 1.0 without over-committing to advanced public plugin APIs.

## Goals

- Refactor Velite's core from a script-like build flow into a clear build engine.
- Give each build an isolated `BuildSession` that owns state and caches.
- Organize the core flow as pipeline-shaped internal stages: config, discover, load, parse, asset collection, output, hooks, and watch.
- Make core modules unit-testable without always running full fixture builds.
- Keep the public API stable where practical: `build()`, `defineConfig()`, schemas, and config hooks.
- Keep room for future pipeline/plugin extension points without exposing them prematurely.

## Non-Goals

- Do not expose a full stage-based plugin API in 1.0.
- Do not introduce heavy abstractions such as a dependency injection container or event bus.
- Do not rewrite every schema, loader, and output detail at once.
- Do not optimize watch mode for fine-grained incremental rebuilds before state ownership is correct.
- Do not export `src/core/*` as public API.

## Design Principle

Use approach B as the architecture and approach C as the internal shape:

- Build a clear internal core architecture first.
- Shape the internals like a pipeline so future extension points can wrap existing stages.
- Keep public extension APIs conservative for 1.0 because current config hooks are enough for short-term needs.

## Proposed Module Layout

```text
src/
  index.ts             public API entry and build() facade
  cli.ts               CLI entry
  types.ts             public TypeScript interfaces and selected public type re-exports
  loaders/             built-in loaders
  schemas/             custom Zod schemas
  core/
    engine.ts          BuildEngine orchestration
    session.ts         BuildSession and state/cache lifecycle
    store.ts           typed, session-scoped state registry
    context.ts         parser context with { config, file, store }
    file.ts            VeliteFile loading/data object
    logger.ts          Logger interface and default logger
    utils.ts           internal utilities
    config.ts          ConfigLoader and temporary config bundle lifecycle
    discover.ts        content file discovery
    assets.ts          asset helpers/plugins, AssetStore, assetStoreKey
    unique.ts          UniqueStore and uniqueStoreKey
    output.ts          OutputWriter
    watch.ts           WatchController
```

### Public Facade

`src/index.ts` owns the public `build()` facade. It receives `Options`, creates or delegates to the core engine, and returns the build result. It should not directly own caches, asset state, file discovery, parsing, output writing, or watch orchestration.

The root `src/` directory should stay slim: public entry (`index.ts`), CLI entry (`cli.ts`), public types (`types.ts`), loaders, schemas, and the flat `core/` implementation directory. Do not introduce nested `core/` subdirectories unless there is a clear need.

### Core Modules

`src/core/*` is internal. It must not be exported directly from `src/index.ts`. If a stable public type is needed, expose it through `src/types.ts` instead of exporting internal modules.

This avoids accidental public APIs such as internal cache clearing helpers.

`ConfigLoader` owns the lifecycle of temporary config bundles created by esbuild. It should decide where compiled config files live, how dependency resolution works from that location, and when stale temporary files or symlinks are replaced. User config compilation must not write into user `node_modules`.

When the same `ConfigLoader` is used across watch reloads in a long-running engine, it should replace the previous temporary bundle in place rather than accumulating one bundle per reload.

`core/assets.ts` should contain asset helpers, plugin factories, the session-owned `AssetStore`, and `assetStoreKey`. Public helpers such as `isRelativePath()` and `getImageMetadata()` may be re-exported from `src/index.ts`, but implementation stays in core.

## Build Data Flow

One build should follow a clear data flow:

```text
build(options)
  -> ConfigLoader.load(options)
  -> BuildSession.create(config, options)
  -> OutputWriter.writeEntry(session)
  -> ContentResolver.resolve(session)
  -> OutputWriter.writeDataAndAssets(session, resolved)
  -> run complete hook
  -> optionally WatchController.start(engine, config)
  -> return result
```

The internal engine should expose a small contract:

```ts
type BuildEngine = {
  build(options: Options): Promise<Result>
  rebuild(): Promise<Result>
  readonly config: Config | undefined
}
```

`Result` is the current public build result shape, equivalent to `Record<string, unknown>`. Do not widen the public `build()` return value in this refactor.

`rebuild()` creates a fresh `BuildSession` from the engine's current resolved config. It does not reload config, does not honor `output.clean`, and does not rerun `OutputWriter.writeEntry()`. It still ensures output directories exist before writing. Config reload and entry regeneration belong to the watch branch that handles config dependency changes.

The engine should expose its current resolved config internally as `engine.config` after `build()` completes so `WatchController` can re-arm itself with updated `configImports` and collection patterns after a config dependency reload. This must not change the public `build()` return value.

Expanded flow:

```text
Options
  -> ConfigLoader
  -> ResolvedConfig
  -> BuildSession
  -> OutputWriter writes entry and d.ts from config collections
  -> Discover collection file paths
  -> Load VeliteFile objects
  -> Parse records with ParserContext
  -> Build Result and file messages
  -> Prepare hook
  -> OutputWriter writes JSON data and assets
  -> Complete hook
```

`OutputWriter.writeEntry()` may run before content resolution because entry files and type declarations depend on the resolved config and collection schemas, not on parsed content results. Content changes in watch mode do not need to rewrite entry files; config dependency changes reload config and start a fresh build, which rewrites entry files.

## Parser Context

`ParserContext` should expose only the capabilities schema callbacks need. It should not expose the whole session and should not grow schema-specific fields.

Proposed shape:

```ts
type ParserContext = {
  config: Config
  file: VeliteFile
  store: SessionStore
}
```

`SessionStore` is a typed, session-scoped registry:

```ts
type StoreKey<T> = {
  readonly id: symbol
  readonly create: () => T
}

type SessionStore = {
  get<T>(key: StoreKey<T>): T
  has<T>(key: StoreKey<T>): boolean
}
```

Schemas such as `s.file()` and `s.image()` should collect assets through `context().store.get(assetStoreKey)` rather than writing to a module-level asset map or requiring `ParserContext.assets`.

Schemas such as `s.unique()` should use `context().store.get(uniqueStoreKey)` rather than a module-level unique cache or requiring `ParserContext.unique`. This keeps unique value state inside the current session while keeping the parser context generic.

Markdown and MDX linked-file copying currently runs inside remark/rehype plugins created by the markdown/mdx schemas. Those plugins should receive `AssetStore` explicitly when they are constructed, instead of relying on a module-level asset map. `AsyncLocalStorage` usually propagates through promise chains, but explicit injection is clearer and avoids hidden assumptions if unified internals change.

Existing public `context()` behavior should remain stable for user code. New fields should be added carefully and documented only if they are meant to be public.

## Hook Context

Existing config hooks should remain conservative:

```ts
prepare(result, { config })
complete(result, { config })
```

The core may use a richer internal session, but `HookContext` should not automatically expose session internals. This keeps the 1.0 public API smaller and easier to maintain.

## BuildSession State Model

All build-scoped mutable state should belong to `BuildSession`.

```ts
type BuildSession = {
  config: Config
  options: Options
  files: FileCache
  resolved: CollectionCache
  store: SessionStore
  output: OutputState
}
```

`options` stored on the session is the resolved options object after defaults have been applied, not the raw user input. This avoids duplicate defaulting logic across engine and session code.

If a session identifier becomes useful for logs or debug traces, add it later as an internal optional field. It is not required for the core state model.

Rules:

- A normal `build()` creates a fresh session.
- Sessions are not reused across independent builds.
- Module-level mutable build state should be eliminated.
- Utility functions, schema factories, and public facades can remain module-level if they are stateless.
- `AsyncLocalStorage` may continue to hold the current parser context during parsing, but the context should point at current session-owned capabilities.

`VeliteFile` should no longer own a static global file cache. File caching should move to a session-owned file cache, for example:

```ts
type FileCache = {
  get(path: string): VeliteFile | undefined
  load(path: string, loaders: Loader[]): Promise<VeliteFile>
}
```

The preferred migration path is `session.files.load(path, loaders)` and `session.files.get(path)` rather than adding cache parameters to `VeliteFile.create()` or using another `AsyncLocalStorage` lookup. `VeliteFile` should remain the loaded file data object, not the cache manager.

## AssetStore

`AssetStore` should represent assets collected during the current session.

Future-friendly asset records should include source ownership:

```ts
type AssetRecord = {
  sourcePath: string
  outputName: string
  publicUrl: string
  ownerFiles: Set<string>
}

type AssetStore = {
  add(record: { sourcePath: string; outputName: string; publicUrl: string; ownerFile: string }): AssetRecord
  list(): AssetRecord[]
  byOwner(file: string): AssetRecord[]
}
```

`outputName` is the rendered output filename, such as `cover-a1b2c3d4.png`. It should be the asset output key. `sourcePath` is the original absolute file path. `publicUrl` is the final URL exposed in parsed content. `ownerFiles` records every content file that caused this asset to be collected.

`AssetStore.add()` should be idempotent for the same `outputName`. The same `outputName` with a different `sourcePath` is accepted when the caller proves the source content is byte-identical (typically by passing a content fingerprint). Different content under the same `outputName` is a hard error because it indicates a hash collision or an unsafe filename template.

This allows future incremental watch mode to remove assets owned by a changed file while keeping assets still owned by other files. The 1.0 implementation does not need fine-grained incremental asset updates, but it should avoid designs that make them impossible.

## UniqueStore

The unique value cache should become session-owned:

```ts
type UniqueStore = {
  register(group: string, value: string, file: string): string | undefined
}
```

`group` matches the current `s.unique(group)` namespace. It is not necessarily a collection name. `register()` returns the conflicting file path when the value already exists, or `undefined` after registering a new value. This preserves the existing duplicate error message that includes the conflicting path.

Independent builds should not need global reset calls. Watch mode can create a fresh session per rebuild until a proper dependency graph exists; see Open Follow-Up: incremental rebuilds.

## Diagnostics

Do not introduce a separate `Diagnostics` store in the first refactor unless it has clear producers and consumers. Current diagnostics live on `VeliteFile` as vfile messages and are reported by the resolver. The initial core split should keep that behavior: parser and loader issues attach to files, and `ContentResolver` derives reports from resolved files. A dedicated diagnostics object can be introduced later if hooks or tooling need a structured diagnostic API.

## OutputState

Data output caching can be session-owned or watch-owned. Independent `build()` calls must not reuse a previous call's data emit cache, because a user may delete the output directory between builds. Watch mode may keep output cache in watch state, but it must not affect fresh non-watch builds.

Minimal shape:

```ts
type OutputState = {
  emitted: Map<string, string>
}
```

`emitted` is keyed by output path and stores the last written content for data/entry skip-if-same behavior. Asset output does not belong in this cache in the initial design; assets should be copied from the current `AssetStore`, or later cached by target path plus content hash/mtime if needed.

Asset output should not use an incomplete cache keyed only by asset name and source path.

Safer options:

- Always copy assets from the current `AssetStore`.
- Or cache by target path and content hash/mtime if performance becomes important.

Data file output can keep content-based skipping because the target path and content are known.

## Watch Strategy

For 1.0, watch mode should prefer correctness over fine-grained incremental performance.

```text
watch event
  -> if config dependency changed:
       close watcher
       call the config-reload path
       re-arm watcher with new resolved config
  -> if content changed:
       create new BuildSession
       full resolve
       output current result/assets
```

`WatchController` responsibilities:

- Create and close chokidar watchers.
- Classify events.
- Detect config dependency changes.
- Trigger `engine.rebuild()` on content changes and the config-reload path on config dependency changes.
- Avoid direct cache mutation, parsing, or output writing.

`WatchController` should not hold a `BuildSession`. It holds the engine and current config. On each content change it calls `engine.rebuild()` to create a fresh session. The old session is no longer referenced and can be garbage-collected.

The config-reload path should call internal `engine.build({ ...options, clean: false })` rather than recursing through the public `build()` facade. Watch reloads must explicitly pass `clean: false`; the engine itself does not track whether `clean` has already been honored. The watch controller then reads `engine.config` and re-arms itself with the new `configImports` and collection patterns.

Fine-grained incremental rebuilds should be a later optimization based on explicit data structures such as `AssetStore.ownerFiles` and a dependency graph.

This is an intentional performance trade-off. The current implementation has a `changed` path that can skip some unchanged files. The first core watch redesign may move single-file changes from roughly changed-file work toward full-project work. That trade-off is acceptable for 1.0 correctness, but it should be measured on larger content projects before release if watch performance is a concern.

## Testing Strategy

Testing should use three layers.

### Unit Tests

Core modules should be testable with fake dependencies:

- `ConfigLoader`
- `AssetStore`
- `ContentResolver`
- `OutputWriter`
- `BuildSession`

Use selective dependency injection rather than full virtualization. Only modules that perform direct IO should accept dependency objects. `OutputWriter` should accept filesystem dependencies, and `Discover` should accept glob dependencies. Other modules should prefer direct values or synthetic inputs in tests.

Example dependency shape:

```ts
type CoreDeps = {
  fs: FileSystem
  glob: Glob
  logger: Logger
}
```

Default dependencies use real implementations. Unit tests pass hand-written fakes where needed. Use the repository's existing `node:test` stack rather than adding a new test framework just for core unit tests.

Logger should become session-scoped for core execution. The public facade may keep a module-level logger export for compatibility, but core modules should receive the session logger through dependencies or session context instead of mutating a process-level singleton during builds. This avoids log-level races between concurrent builds and makes log output testable.

### Integration Tests

Keep real fixture tests for:

- basic project
- Next.js project
- Vite project

These verify package entry behavior and real application integration.

### Regression Tests

Keep or add focused tests for known architectural failure modes:

- Consecutive builds do not reuse unique values.
- Consecutive builds do not reuse assets.
- Consecutive builds do not skip asset copies due to cross-build state.
- Config compilation does not write to user `node_modules`.
- Config dependencies resolve to correct absolute paths.
- Calling `build()` twice with the data output directory deleted between calls produces all expected JSON files on the second call.
- Watch content changes do not output stale assets.
- Watch config dependency changes reload config.

## Migration Plan

### Phase 1: Create Core Skeleton Without Behavior Changes

- Create `src/core/`.
- Add initial core modules listed in the layout that are needed at this stage: `session.ts`, `store.ts`, `engine.ts`, `assets.ts`, `output.ts`, `config.ts`. Defer `discover.ts`, `resolver.ts`, and `watch.ts` until their phases.
- Keep `index.ts` as the public facade, including `build()`.
- Move existing logic behind the facade without intentionally changing behavior.
- Keep existing tests passing.
- Keep `ConfigLoader` responsible for temporary config bundle paths, dependency resolution from the temp location, and stale temp symlink replacement.

### Phase 2: Move Mutable Build State Into BuildSession

- Move schema-owned state into `BuildSession.store`.
- Move loaded files into `BuildSession.files`.
- Move asset collection behind `assetStoreKey`.
- Move unique cache behind `uniqueStoreKey`.
- Move resolved collections into `BuildSession.resolved`.
- Move output state into session or watch state.
- Replace `VeliteFile.get/create` cache ownership with `session.files.get/load`.
- Wire session-owned `store` into the existing parser context as part of this phase. Do not leave an intermediate state where schemas still rely on module-level globals.
- Remove module-level mutable build state.

### Phase 3: Split Resolver, Parser, and Output Writer

- Split current resolve logic into discovery, load, parse, file-message reporting, and result assembly.
- Make `OutputWriter` responsible only for entry, type declarations, JSON data, and assets.
- Adjust schemas (`s.file()`, `s.image()`, `s.unique()`, markdown/mdx) to consume the parser-context capabilities introduced in Phase 2 instead of direct globals.
- Pass `AssetStore` explicitly into remark/rehype linked-file plugins when markdown/mdx schemas construct them.
- Construct a session-scoped logger and pass it through core dependencies or session context. Keep any public logger facade as compatibility glue, not as core build state.

### Phase 4: Rebuild Watch Around Correctness

- Introduce `WatchController`.
- Reload config on config dependency changes.
- Use a new session and full resolve on content changes.
- Do not let `WatchController` retain build sessions across content-change events.
- Add watch regression tests.

### Phase 5: Add Unit Test Coverage

- Add unit tests for config loading, asset store, output writer, content resolver, and session lifecycle.
- Keep fixture tests as integration tests.

### Phase 6: Optional Incremental Optimization

- Add source ownership and dependency graph based incremental rebuilds only if watch performance becomes a proven problem.
- Do not make this a required 1.0 milestone.

## Compatibility Strategy

- Keep `build(options)` stable.
- Keep `defineConfig`, `defineCollection`, and `defineSchema` stable.
- Keep schema public APIs stable where practical.
- Keep `prepare` and `complete` config hooks stable.
- Do not export `src/core/*`.
- Do not expose a stage-based plugin API in 1.0.
- Document core architecture in contributor-facing docs only, not public API reference.

## Acceptance Criteria

- Build-related mutable state is no longer stored in module-level globals.
- Independent builds are isolated by construction, not by manual global reset calls.
- `AssetStore.add()` rejects two records with the same `outputName` whose source content differs.
- `ContentResolver` can be unit-tested with fake file data and fake loaders.
- `OutputWriter` can be unit-tested without running a full fixture project.
- Watch config changes and content changes have regression coverage.
- Calling `build()` twice with the data output directory deleted between calls produces all expected JSON files on the second call.
- Existing `pnpm build`, `pnpm test`, and `pnpm docs:build` pass.
- No internal core module is accidentally exported as public API.

## Open Follow-Up

Watch mode intentionally starts with full rebuilds for correctness. This may regress single-file watch rebuild performance from changed-file work toward full-project work. If performance becomes an issue, introduce incremental rebuilds later using explicit ownership and dependency graph data structures.
