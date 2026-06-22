import { createBuilder } from './core'
import { join } from './core/util/path'
import { nodeRuntime } from './runtime/adapters/node'

import type { Builder, BuildResult, WatchHandle } from './core'

export interface BuildEntryOptions {
  /** Project directory (default: process.cwd()). */
  cwd?: string
  /** Config path (relative to cwd or absolute). Default: auto-detect velite.config.*. */
  config?: string
  /** Output layout (default: `single` in production, `split` otherwise). */
  layout?: 'split' | 'single'
}

const resolveConfigOption = (cwd: string, explicit: string | undefined): string | undefined => {
  if (explicit === undefined) return undefined
  if (explicit.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(explicit)) return explicit
  return join(cwd, explicit)
}

/** Create a durable Node builder. Advanced/stateful entry; also the DI seam. */
export const builder = (options: BuildEntryOptions = {}): Builder => {
  const cwd = options.cwd ?? process.cwd()
  return createBuilder(nodeRuntime, { cwd, configPath: resolveConfigOption(cwd, options.config) })
}

/** One-shot build with the default Node runtime. */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    return await instance.build({ layout })
  } finally {
    await instance.dispose()
  }
}

/** Watch mode: long-lived builder reacting to file events via the runtime watcher. */
export const watch = async (options: BuildEntryOptions = {}): Promise<WatchHandle> => {
  return builder(options).watch()
}

export { createBuilder, defineCollection, defineConfig, s } from './core'
export type {
  Builder,
  BuildOptions,
  BuildResult,
  CollectionDef,
  CollectionResult,
  Diagnostic,
  Entry,
  Infer,
  Loader,
  LogicalOutput,
  PrepareContext,
  PrepareHook,
  PrepareResult,
  ResolvedConfig,
  Schema,
  SchemaNamespace,
  UserConfig,
  WatchHandle,
  WatchOptions
} from './core'
// Runtime port types — sourced directly from src/runtime (core re-exports are
// gone; the port types are provided by the runtime layer, not the core layer).
export type { FileEvent, FileSystem, ImageProcessor, Logger, ModuleLoader, Runtime, Watcher } from './runtime'
