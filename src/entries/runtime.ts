// Advanced surface for adapter authors, framework integrators, and anyone who
// wants to drive Velite from something other than the default Node runtime.
//
// Two main reasons to import from `velite/runtime` rather than `velite`:
//   1. You need a `Runtime` port type (`FileSystem`, `ModuleLoader`,
//      `ImageProcessor`, `Logger`, `Watcher`, `Runtime`) to implement your own
//      adapter for a non-Node host (Deno, Bun, a bundler virtual fs, …).
//   2. You want to wire `createBuilder` against a custom Runtime, or you need
//      the lower-level pieces (`resolveConfig`, the scheduler primitives, the
//      `VeliteError` helpers).
//
// The default Node runtime (`nodeRuntime`) is re-exported so an adapter author
// can mix and match — e.g. take the Node `fs` and `image` adapters but swap in
// their own `modules` loader for a bundler-driven config import.

// Composition root: build a Builder against any Runtime.
export { createBuilder } from '../core'
export type { Builder, BuildOptions, CreateBuilderOptions, WatchOptions } from '../core'

// Runtime port types — the contracts adapters implement.
export type { FileEvent, FileSystem, ImageProcessor, Logger, ModuleLoader, Runtime, Watcher } from '../runtime'

// The default Node adapter bundle (sharp + jiti + chokidar + node:fs/posix).
export { nodeRuntime } from '../runtime/adapters/node'

// Config facade and the runtime slice it needs (`{ fs, modules }`).
export { ConfigError, resolveConfig, validateConfig } from '../core'
export type { ConfigRuntime, ResolveConfigOptions } from '../core'

// Driver-level types — useful when implementing custom build orchestration.
export type { ApplyResult, DriverRuntime } from '../core'

// Scheduler primitives — useful when driving the watch loop from a custom
// event source (e.g. a bundler's HMR events instead of chokidar).
export { mergeEvents } from '../core'
export type { Scheduler } from '../core'

// Loader registry — for runtimes that want to plug in custom file loaders.
export { createLoaderRegistry } from '../core'
export type { LoadedItem, LoaderInput, LoaderRegistry, LoaderResult } from '../core'

// Diagnostics: structured error reporting + the VeliteError exception type.
export { assert, codeFromDiagnostics, diagnostic, fail, flattenError, hasFatalDiagnostic, isError, isVeliteError, VeliteError } from '../core'
export type { DiagnosticCode, DiagnosticLevel, DiagnosticStage, VeliteErrorCode } from '../core'

// Model types — entries, sources, identities. Useful when inspecting build
// results at a finer grain than the public `BuildResult`.
export type { Collection, EntryId, OutputManifest, RawEntry, Source, SourcePath } from '../core'
