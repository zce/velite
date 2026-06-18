import { createBuildEngine } from './core/engine'
import { createWatchController } from './core/watch'

import type { Options } from './core/types'
import type { Watcher } from './core/watch'

export type { Options }
export type { Watcher }
export type { BlurOptions, Image } from './core/assets'
export { getImageMetadata, isRelativePath } from './core/assets'
export { context, parseWithContext } from './core/context'
export { VeliteFile } from './core/file'
export { createLogger, logger } from './core/logger'
export * from './schemas'
export * from './types'

/**
 * Build all collections defined in the user config.
 *
 * Each call creates a fresh build engine and (for `watch: true`) a watch
 * controller. The public return shape is preserved as `Record<string, unknown>`.
 */
export const build = async (options: Options = {}): Promise<Record<string, unknown>> => {
  const engine = createBuildEngine()
  const result = await engine.build(options)
  if (options.watch === true) {
    const controller = createWatchController()
    await controller.start(engine, options)
  }
  return result
}

/**
 * Build once and keep watching for future changes.
 *
 * Unlike `build({ watch: true })`, this programmatic API returns a watcher
 * handle so callers can close it when they are done.
 */
export const watch = async (options: Options = {}): Promise<Watcher> => {
  const engine = createBuildEngine()
  await engine.build({ ...options, watch: false })
  const controller = createWatchController()
  return await controller.start(engine, options)
}
