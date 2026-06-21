// Public API entry.
//
// The root barrel exposes the product concepts (build, watch, config, collection,
// loader, schema, context, effects) and the integration types. Internal pipeline
// objects (dependency graph, cache registry, pipeline stages, output committer)
// are not exported.

export { build, watch } from './app/build'
export { defineCollection } from './collections'
export { defineConfig } from './config'
export { defineLoader } from './loaders'
export { context } from './schemas/context'
export { s } from './schemas'
export { VeliteError } from './core/errors'

// Public type surface.
export type { BuildOptions } from './app/engine'
export type { BuildResult } from './collections'
export type { WatchOptions, Watcher, WatchBuildEvent } from './app/watch'
export type { UserConfig, PrepareHook, PrepareContext } from './config'
export type { OutputConfig } from './output'
export type { LogLevel, Logger } from './runtime/logger'
export type { Collection, Collections, CollectionResult } from './collections'
export type { Loader, LoaderSource, LoaderContext, LoaderResult, LoaderRecord } from './loaders/types'
export type { VeliteSchema, InferSchema } from './schemas'
export type { SchemaContext, ProjectInfo, ContentFile, ContentRecord } from './schemas/context'
export type { Effect, UniqueEffect, AssetReferenceEffect, SourceDependencyEffect } from './schemas/effects'
export type { AssetProcessingCache } from './assets/cache'
export type { AssetStore, AssetRecord } from './assets/store'
export type { SessionStore } from './core/session'
export type { Diagnostic, DiagnosticSeverity, DiagnosticStage } from './core/errors'
export type { FileOptions } from './schemas/file'
export type { ImageOptions, ImageData, ImageBlurOptions } from './assets/image'
export type { MarkdownOptions } from './schemas/markdown'
export type { MdxOptions } from './schemas/mdx'
export type { TocOptions, TocEntry, TocTree } from './schemas/toc'
export type { ExcerptOptions } from './schemas/excerpt'
export type { PathOptions } from './schemas/path'
export type { Metadata } from './schemas/metadata'
