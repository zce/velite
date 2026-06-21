import { existsSync } from 'node:fs'

import { createBuilder } from './core'
import { posix } from './core/util/path'
import { nodeHost } from './host'

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
  return createBuilder(nodeHost, { cwd, configPath: resolveConfigPath(cwd, options.config) })
}

/** One-shot build with the default Node host. */
export const build = async (options: BuildEntryOptions = {}): Promise<BuildResult> => {
  const layout = options.layout ?? (process.env.NODE_ENV === 'production' ? 'single' : 'split')
  const instance = builder(options)
  try {
    return await instance.build({ layout })
  } finally {
    instance.dispose()
  }
}

/** Watch mode: long-lived builder reacting to file events via the host watcher. */
export const watch = async (options: BuildEntryOptions = {}): Promise<WatchHandle> => {
  return builder(options).watch()
}

export { createBuilder, defineConfig, defineCollection, s } from './core'
export type {
  Builder,
  BuildOptions,
  WatchOptions,
  WatchHandle,
  BuildResult,
  UserConfig,
  CollectionDef,
  Schema,
  Infer,
  Diagnostic,
  Loader,
  Host,
  FileSystem,
  Watcher,
  ImageProcessor,
  ConfigLoader,
  Logger,
  Entry,
  CollectionResult,
  LogicalOutput,
  PrepareHook,
  PrepareContext,
  PrepareResult
} from './core'
