import { createBuilder, VeliteError } from './core'
import { join } from './core/util/path'
import { nodeRuntime, setLogLevel } from './runtime/adapters/node'

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

const applyShellOptions = (options: BuildEntryOptions): void => {
  if (options.logLevel !== undefined) setLogLevel(options.logLevel)
}

const enforceStrict = (result: BuildResult, strict: boolean | undefined): void => {
  if (strict !== true) return
  if (!result.diagnostics.some(d => d.level === 'error')) return
  throw new VeliteError('schema', { message: 'build produced error diagnostics in strict mode', diagnostics: result.diagnostics })
}

/** Create a durable Node builder. Advanced/stateful entry; also the DI seam. */
export const builder = (options: BuildEntryOptions = {}): Builder => {
  const cwd = options.cwd ?? process.cwd()
  return createBuilder(nodeRuntime, { cwd, configPath: resolveConfigOption(cwd, options.config) })
}

/**
 * One-shot build with the default Node runtime. Resolves once the build
 * completes (no watcher); use {@link watch} to keep listening for changes.
 */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  applyShellOptions(options)
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
  applyShellOptions(options)
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    if (options.clean === true) await instance.clean()
    const initial = await instance.build({ layout })
    enforceStrict(initial, options.strict)
    const inner = await instance.watch()
    return {
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

export { context, createBuilder, defineCollection, defineConfig, defineLoader, defineSchema, s, VeliteError } from './core'
export type {
  BlurOptions,
  Builder,
  BuildOptions,
  BuildResult,
  CollectionDef,
  CollectionResult,
  ContentFile,
  Diagnostic,
  Entry,
  ExcerptSchemaOptions,
  FileSchemaOptions,
  ImageData,
  ImageSchemaOptions,
  Infer,
  Loader,
  LogicalOutput,
  MarkdownOptions,
  MarkdownSchemaOptions,
  MdxOptions,
  MdxSchemaOptions,
  Metadata,
  PathSchemaOptions,
  PrepareCollections,
  PrepareContext,
  PrepareHook,
  PrepareResult,
  ResolvedConfig,
  Schema,
  SchemaContext,
  SchemaNamespace,
  TocItem,
  UserConfig,
  VeliteErrorCode,
  WatchHandle,
  WatchOptions
} from './core'
// Runtime port types — sourced directly from src/runtime (core re-exports are
// gone; the port types are provided by the runtime layer, not the core layer).
export type { FileEvent, FileSystem, ImageProcessor, Logger, LogLevel, ModuleLoader, Runtime, Watcher } from './runtime'
