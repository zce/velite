import { createBuilder } from './core'
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
  // Pass through as-is when already absolute (posix or windows). The runtime
  // path adapter would otherwise mis-handle drive letters.
  if (explicit.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(explicit)) return explicit
  return nodeRuntime.path.join(cwd, explicit)
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
  FileSystem,
  ImageProcessor,
  Infer,
  Loader,
  Logger,
  LogicalOutput,
  ModuleLoader,
  PrepareContext,
  PrepareHook,
  PrepareResult,
  Runtime,
  Schema,
  UserConfig,
  Watcher,
  WatchHandle,
  WatchOptions
} from './core'
