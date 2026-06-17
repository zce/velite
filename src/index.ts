import { createBuildEngine } from './core/engine'
import { createWatchController } from './core/watch'

import type { Options } from './core/types'

export type { Options }
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
