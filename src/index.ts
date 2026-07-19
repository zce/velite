import { VeliteError } from './core'
import { createBuilder } from './core/builder'
import { createSchemaRunner, ensureHostInstalled } from './core/schema/runner'
import { join } from './core/util/path'
import {
  createChokidarWatcher,
  createJitiModuleLoader,
  createLogger,
  createNodeFileSystem,
  createNodeSchemaContextHost,
  createSharpImageProcessor
} from './runtime/adapters/node'

import type { Builder, BuildResult, WatchHandle } from './core'
import type { LogLevel } from './runtime'

export interface BuildEntryOptions {
  /** Project directory (default: process.cwd()). */
  cwd?: string
  /** Config path (relative to cwd or absolute). Default: auto-detect velite.config.*. */
  config?: string
  /** Output layout (default: `single` in production, `split` otherwise). */
  layout?: 'split' | 'single'
  /** Remove the output directories before the (first) build. */
  clean?: boolean
  /** Throw a {@link VeliteError} when the build produces any error-level diagnostic. */
  strict?: boolean
  /** Console logger verbosity. */
  logLevel?: LogLevel
}

const resolveConfigOption = (cwd: string, explicit: string | undefined): string | undefined => {
  if (explicit === undefined) return undefined
  if (explicit.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(explicit)) return explicit
  return join(cwd, explicit)
}

const enforceStrict = (result: BuildResult, strict: boolean | undefined): void => {
  if (strict !== true) return
  if (!result.diagnostics.some(d => d.level === 'error')) return
  throw new VeliteError('schema', { message: 'build produced error diagnostics in strict mode', diagnostics: result.diagnostics })
}

/** Create a durable Node builder. Advanced/stateful entry; also the DI seam. */
export const builder = (options: BuildEntryOptions = {}): Builder => {
  const cwd = options.cwd ?? process.cwd()
  // Install or obtain the one process-wide SchemaContextHost. The default
  // Node runtime composition owns it for the process lifetime; installing the
  // identical host is idempotent, and installing a different host after the
  // first is a deterministic internal configuration failure. The host only
  // propagates the current SchemaRunContext — it owns no Builder/epoch/broker/
  // generation/publication/cache/registry/lifecycle state.
  const host = ensureHostInstalled(createNodeSchemaContextHost)
  const schemaRunner = createSchemaRunner(host)
  return createBuilder({
    cwd,
    configPath: resolveConfigOption(cwd, options.config),
    fs: createNodeFileSystem(),
    modules: createJitiModuleLoader({}),
    schemaRunner,
    logger: createLogger({ level: options.logLevel ?? 'info' }),
    image: createSharpImageProcessor(),
    watch: createChokidarWatcher
  })
}

/**
 * One-shot build with the default Node runtime. Resolves once the build
 * completes (no watcher); use {@link watch} to keep listening for changes.
 */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    if (options.clean === true) await instance.clean()
    const result = await instance.build({ layout })
    enforceStrict(result, options.strict)
    return result
  } finally {
    await instance.dispose()
  }
}

/**
 * Watch mode: run an initial build, then keep a long-lived builder reacting to
 * file events. The returned {@link WatchHandle} owns the watcher; closing it
 * also disposes the builder.
 */
export const watch = async (options: BuildEntryOptions = {}): Promise<WatchHandle> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    if (options.clean === true) await instance.clean()
    // Builder.watch() performs the single initial build and returns its
    // BuildResult on the handle — we use it for strict-mode handling here
    // instead of running a second build through the public facade.
    const inner = await instance.watch({}, { layout })
    enforceStrict(inner.initial, options.strict)
    return {
      initial: inner.initial,
      close: async () => {
        await inner.close()
        await instance.dispose()
      }
    }
  } catch (err) {
    await instance.dispose()
    throw err
  }
}

export { context, defineCollection, defineConfig, defineLoader, defineSchema, s, VeliteError } from './core'
export type {
  AssetReferenceEffect,
  AssetRequest,
  AssetResult,
  BlurOptions,
  Builder,
  BuildOptions,
  BuildResult,
  CollectionDef,
  CollectionResult,
  ContentFile,
  ContentRecord,
  Diagnostic,
  Effect,
  EffectDeclarationContext,
  Entry,
  ExcerptSchemaOptions,
  FileSchemaOptions,
  ImageData,
  ImageMetadata,
  ImageSchemaOptions,
  Infer,
  LoadedItem,
  Loader,
  LoaderInput,
  LoaderResult,
  LogicalOutput,
  MarkdownOptions,
  MarkdownSchemaOptions,
  MdxOptions,
  MdxSchemaOptions,
  Metadata,
  PathSchemaOptions,
  PrepareCollections,
  PrepareContext,
  PrepareDiagnosticInput,
  PrepareHook,
  PrepareResult,
  ProjectCollectionInfo,
  ProjectInfo,
  ResolvedConfig,
  Schema,
  SchemaContext,
  SchemaEffectDeclaration,
  SchemaNamespace,
  SessionStore,
  StableOccurrence,
  TocItem,
  UniqueEffect,
  UserConfig,
  VeliteErrorCode,
  WatchHandle,
  WatchOptions
} from './core'
// Runtime port types — sourced directly from src/runtime (core re-exports are
// gone; the port types are provided by the runtime layer, not the core layer).
export type { FileEvent, FileSystem, ImageProcessor, Logger, LogLevel, ModuleLoader, Watcher } from './runtime'
