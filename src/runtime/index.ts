import type { ConfigLoader } from './config'
import type { FileSystem } from './fs'
import type { ImageProcessor } from './image'
import type { Logger } from './logger'
import type { Path } from './path'
import type { Watcher } from './watcher'

/**
 * The runtime contract bundle: the core's complete set of runtime dependencies.
 * Velite's pure core (engine + pipeline + schemas) is runtime-agnostic — it
 * consumes this interface; adapters (`src/adapters/`) implement it. This plain
 * object doubles as the "container" for the project's manual dependency
 * injection (no DI framework), assembled once at the composition root.
 */
export interface Runtime {
  fs: FileSystem
  config: ConfigLoader
  path: Path
  logger?: Logger
  image?: ImageProcessor
  watch?: (paths: string[]) => Watcher
}

export type { ConfigLoader } from './config'
export type { FileSystem } from './fs'
export type { ImageProcessor } from './image'
export type { Logger } from './logger'
export type { Path } from './path'
export type { FileEvent, Watcher } from './watcher'
