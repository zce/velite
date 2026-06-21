import { jitiConfigLoader } from './config-loader'
import { posix } from './core/util/path'
import { nodeFileSystem } from './fs'
import { consoleLogger } from './logger'
import { createChokidarWatcher } from './watcher'

import type { Host } from './core/host'

/** Default Node host: the wired-up set of runtime adapters. */
export const nodeHost: Host = {
  fs: nodeFileSystem,
  config: jitiConfigLoader,
  logger: consoleLogger,
  path: posix,
  watch: paths => createChokidarWatcher(paths)
}
