import { existsSync } from 'node:fs'
import posix from 'node:path/posix'

import { nodeRuntime } from './adapters/runtime'
import { createBuilder } from './core'

import type { Builder, BuildResult, WatchHandle } from './core'

const CONFIG_CANDIDATES = ['velite.config.ts', 'velite.config.js', 'velite.config.mjs']

const resolveConfigPath = (cwd: string, explicit?: string): string => {
  if (explicit !== undefined) return posix.join(cwd, explicit)
  for (const name of CONFIG_CANDIDATES) {
    const candidate = posix.join(cwd, name)
    if (existsSync(candidate)) return candidate
  }
  return posix.join(cwd, CONFIG_CANDIDATES[0]!)
}

export interface BuildEntryOptions {
  /** Project directory (default: process.cwd()). */
  cwd?: string
  /** Config path relative to cwd (default: auto-detect velite.config.*). */
  config?: string
  /** Output layout (default: `single` in production, `split` otherwise). */
  layout?: 'split' | 'single'
}

/** Create a durable Node builder. Advanced/stateful entry; also the DI seam. */
export const builder = (options: BuildEntryOptions = {}): Builder => {
  const cwd = options.cwd ?? process.cwd()
  return createBuilder(nodeRuntime, { cwd, configPath: resolveConfigPath(cwd, options.config) })
}

/** One-shot build with the default Node runtime. */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    return await instance.build({ layout })
  } finally {
    instance.dispose()
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
  ConfigLoader,
  Diagnostic,
  Entry,
  FileSystem,
  Runtime,
  ImageProcessor,
  Infer,
  Loader,
  Logger,
  LogicalOutput,
  PrepareContext,
  PrepareHook,
  PrepareResult,
  Schema,
  UserConfig,
  Watcher,
  WatchHandle,
  WatchOptions
} from './core'
