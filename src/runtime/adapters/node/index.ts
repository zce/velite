import { createNodeContextStorage } from './contextual'
import { createNodeFileSystem } from './fs'
import { createSharpImageProcessor } from './image'
import { createLogger } from './logger'
import { createJitiModuleLoader } from './modules'
import { createChokidarWatcher } from './watcher'

import type { Runtime } from '../../index'
import type { LogLevel } from '../../logger'

export interface NodeRuntimeDeps {
  logLevel?: LogLevel
}

export const createNodeRuntime = ({ logLevel: loggerLevel }: NodeRuntimeDeps = {}): Runtime => ({
  fs: createNodeFileSystem(),
  modules: createJitiModuleLoader({}),
  contextStorage: createNodeContextStorage(),
  logger: createLogger({ level: loggerLevel ?? 'info' }),
  image: createSharpImageProcessor(),
  watch: createChokidarWatcher
})

/** Default Node runtime: the wired-up set of runtime adapters. */
export const nodeRuntime: Runtime = createNodeRuntime({ logLevel: 'info' })

export { createNodeContextStorage, nodeContextStorage } from './contextual'
export { createNodeFileSystem, nodeFileSystem } from './fs'
export { createSharpImageProcessor, sharpImageProcessor } from './image'
export { createLogger, setLogLevel, silentLogger } from './logger'
export type { LogLevel } from './logger'
export { createJitiModuleLoader, jitiModuleLoader } from './modules'
