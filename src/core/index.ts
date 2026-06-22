// Core barrel: only exports the symbols that the public package entry
// (`src/index.ts`) and internal cross-module callers actually reach through
// this barrel. Everything else is imported directly from the owning module.
//
// Not re-exported here (and why):
// - Runtime port types (`Runtime`, `FileSystem`, etc.) — belong to
//   `src/runtime/`; imported directly by `src/index.ts`.
// - Engine types (`Engine`, `Derivation`, etc.) — internal implementation,
//   not part of any public surface.
// - Pipeline internals (`Pipeline`, `createPipeline`, derivation factories)
//   — used only by `builder.ts`, imported directly.
// - Output internals (`planWrites`, `writeOutput`, layout/declaration helpers)
//   — used only by `driver.ts` / `writer.ts`, imported directly.
// - Content helpers (`processMarkdown`, `processMdx`, `extractText`, etc.)
//   — used only by `builtins.ts` / `context.ts`, imported directly.
// - Scheduler (`mergeEvents`, `createScheduler`, `Scheduler`) — used only
//   by `builder.ts`, imported directly.
// - Loader internals (`createLoaderRegistry`, individual loader types)
//   — used only by `builder.ts` / `load.ts`, imported directly.
// - Individual diagnostic helpers (`fail`, `assert`, `flattenError`, etc.)
//   — used only by `context.ts` / `driver.ts`, imported directly.
// - Model internals (`Source`, `SourcePath`, `RawEntry`, `EntryId`, `Collection`)
//   — used only by pipeline/loader types, imported directly.
// - Config internals (`ConfigRuntime`, `ResolveConfigOptions`, `PrepareResult`)
//   — used only by `config.ts` tests, imported directly.
// - Driver internals (`ApplyResult`, `DriverRuntime`, `OutputManifest`)
//   — used only by `driver.ts` / builder, imported directly.

export { createBuilder } from './builder'
export type { Builder, BuildOptions, CreateBuilderOptions, WatchHandle, WatchOptions } from './builder'

export { ConfigError, defineCollection, defineConfig, resolveConfig, validateConfig } from './config'
export type { CollectionDef, PrepareContext, PrepareHook, PrepareResult, ResolvedConfig, UserConfig } from './config'

export { diagnostic, VeliteError } from './diagnostic'
export type { Diagnostic, VeliteErrorCode } from './diagnostic'

export type { BuildResult } from './driver'

export type { Loader, LoaderRegistry } from './loader'

export type { CollectionResult, Entry } from './model'

export type { LogicalOutput } from './output/logical'

export { s } from './schema'
export type { Infer, Schema, SchemaNamespace } from './schema'
