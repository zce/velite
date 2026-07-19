// Core barrel: only exports the symbols that the public package entry
// (`src/index.ts`) and internal cross-module callers actually reach through
// this barrel. Everything else is imported directly from the owning module.
//
// Not re-exported here (and why):
// - `createBuilder` — internal composition root only; the root package
//   exposes `builder()`/`build()`/`watch()` facades. Source-internal tests
//   import it directly from `./builder`.
// - Runtime port types (`FileSystem`, `Logger`, etc.) — belong to
//   `src/runtime/`; imported directly by `src/index.ts`.
// - Engine types (`Engine`, `Derivation`, etc.) — internal implementation,
//   not part of any public surface.
// - Pipeline internals (`Pipeline`, `createPipeline`, derivation factories)
//   — used only by `builder.ts`, imported directly.
// - Output internals (`planWrites`, `writeOutput`, layout/declaration helpers)
//   — used only by `driver.ts` / `writer.ts`, imported directly.
// - Content helpers (`processMarkdown`, `processMdx`, `extractText`, etc.)
//   — used only by `builtins.ts` / `context.ts`, imported directly.
// - Scheduler (`createScheduler`, `Scheduler`) — used only
//   by `builder.ts`, imported directly.
// - Loader internals (`createLoaderRegistry`, individual loader types)
//   — used only by `builder.ts` / `load.ts`, imported directly.
// - Individual diagnostic helpers (`fail`, `hasFatalDiagnostic`, etc.)
//   — used only by `context.ts` / `driver.ts`, imported directly.
// - Model internals (`Source`, `SourcePath`, `RawEntry`, `EntryId`, `Collection`)
//   — used only by pipeline/loader types, imported directly.
// - Config internals (`ConfigRuntime`, `PrepareResult`)
//   — used only by `config.ts` tests, imported directly.
// - Driver internals (`ApplyResult`, `DriverRuntime`, `OutputManifest`)
//   — used only by `driver.ts` / builder, imported directly.
// - SchemaContextHost, SchemaRunner, SchemaRunContext, lease, private content
//   capability — internal implementation, not part of any public surface.

export type { Builder, BuildOptions, CreateBuilderOptions, WatchHandle, WatchOptions } from './builder'

export { ConfigError, defineCollection, defineConfig, resolveConfig, validateConfig } from './config'
export type {
  CollectionDef,
  PrepareCollections,
  PrepareContext,
  PrepareDiagnosticInput,
  PrepareHook,
  PrepareResult,
  ResolvedConfig,
  UserConfig
} from './config'

export { diagnostic, VeliteError } from './diagnostic'
export type {
  Diagnostic,
  DiagnosticLevel,
  DiagnosticOrigin,
  DiagnosticPoint,
  DiagnosticPosition,
  DiagnosticProvenance,
  DiagnosticStage,
  DiagnosticValue,
  VeliteErrorCode
} from './diagnostic'

export type { BuildResult } from './driver'

export { defineLoader } from './loader'
export type { LoadedItem, Loader, LoaderInput, LoaderResult } from './loader'

export type { CollectionResult, Entry } from './model'

export type { LogicalOutput } from './output/logical'

export { context, defineSchema, s } from './schema'
export type {
  AssetReferenceEffect,
  AssetRequest,
  AssetResult,
  BlurOptions,
  ContentFile,
  ContentRecord,
  Effect,
  EffectDeclarationContext,
  ExcerptSchemaOptions,
  FileSchemaOptions,
  ImageData,
  ImageMetadata,
  ImageSchemaOptions,
  Infer,
  MarkdownRoot,
  MarkdownSchemaOptions,
  MdxRoot,
  MdxSchemaOptions,
  Metadata,
  PathSchemaOptions,
  ProjectCollectionInfo,
  ProjectInfo,
  Schema,
  SchemaContext,
  SchemaEffectDeclaration,
  SchemaNamespace,
  SessionStore,
  StableOccurrence,
  TocItem,
  UniqueEffect
} from './schema'

export type { MarkdownOptions } from './content/markdown'
export type { MdxOptions } from './content/mdx'
