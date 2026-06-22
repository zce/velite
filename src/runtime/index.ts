import type { FileSystem } from './fs'
import type { ImageProcessor } from './image'
import type { Logger } from './logger'
import type { ModuleLoader } from './modules'
import type { Watcher } from './watcher'

/**
 * The runtime contract bundle: the core's complete set of runtime dependencies.
 * Velite's pure core (engine + pipeline + schemas) is runtime-agnostic — it
 * consumes this interface; adapters (`src/runtime/adapters/*`) implement it.
 * This plain object doubles as the "container" for the project's manual
 * dependency injection (no DI framework), assembled once at the composition
 * root.
 *
 * Note: posix path operations are NOT part of the runtime — they are a pure
 * value imported directly from `core/util/path`. See that file's header for
 * the rationale.
 */
export interface Runtime {
  fs: FileSystem
  modules: ModuleLoader
  logger?: Logger
  image?: ImageProcessor
  watch?: (paths: string[]) => Watcher
}

export type { FileSystem } from './fs'
export type { ImageProcessor } from './image'
export type { Logger, LogLevel } from './logger'
export type { ModuleLoader } from './modules'
export type { FileEvent, Watcher } from './watcher'
