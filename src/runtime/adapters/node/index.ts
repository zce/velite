import { nodeContextStorage } from './contextual'
import { nodeFileSystem } from './fs'
import { sharpImageProcessor } from './image'
import { consoleLogger } from './logger'
import { jitiModuleLoader } from './modules'
import { createChokidarWatcher } from './watcher'

import type { Runtime } from '../../index'

/** Default Node runtime: the wired-up set of runtime adapters. */
export const nodeRuntime: Runtime = {
  fs: nodeFileSystem,
  modules: jitiModuleLoader,
  contextStorage: nodeContextStorage,
  logger: consoleLogger,
  image: sharpImageProcessor,
  watch: createChokidarWatcher
}

export { nodeContextStorage } from './contextual'
export { createLogger, setLogLevel, silentLogger } from './logger'
export type { LogLevel } from './logger'
