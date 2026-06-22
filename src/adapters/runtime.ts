import { jitiConfigLoader } from './config'
import { nodeFileSystem } from './fs'
import { sharpImageProcessor } from './image'
import { consoleLogger } from './logger'
import { nodePath } from './path'
import { createChokidarWatcher } from './watcher'

import type { Runtime } from '../runtime'

/** Default Node runtime: the wired-up set of runtime adapters. */
export const nodeRuntime: Runtime = {
  fs: nodeFileSystem,
  config: jitiConfigLoader,
  logger: consoleLogger,
  image: sharpImageProcessor,
  path: nodePath,
  watch: paths => createChokidarWatcher(paths)
}
