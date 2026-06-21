import { jitiConfigLoader } from './config-loader'
import { posix } from './core/util/path'
import { nodeFileSystem } from './fs'
import { sharpImageProcessor } from './image'
import { consoleLogger } from './logger'
import { createChokidarWatcher } from './watcher'

import type { Host } from './core/host'

/** Default Node host: the wired-up set of runtime adapters. */
export const nodeHost: Host = {
  fs: nodeFileSystem,
  config: jitiConfigLoader,
  logger: consoleLogger,
  image: sharpImageProcessor,
  path: posix,
  watch: paths => createChokidarWatcher(paths)
}
