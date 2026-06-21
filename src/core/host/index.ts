import type { ConfigLoader } from './config'
import type { FileSystem } from './fs'
import type { ImageProcessor } from './image'
import type { Logger } from './logger'
import type { Path } from './path'
import type { Watcher } from './watcher'

/**
 * The host contract bundle: the core's complete set of runtime dependencies.
 * This plain object is the "container" for the project's manual dependency
 * injection (no DI framework). Assembled once at the composition root.
 */
export interface Host {
  fs: FileSystem
  config: ConfigLoader
  path: Path
  logger?: Logger
  image?: ImageProcessor
  watch?: (paths: string[]) => Watcher
}

export type { FileSystem } from './fs'
export type { Watcher, FileEvent } from './watcher'
export type { ImageProcessor } from './image'
export type { ConfigLoader } from './config'
export type { Logger } from './logger'
export type { Path } from './path'
