import { init } from './context'
import { logger } from './logger'
import { resolve } from './resolve'
import { watch } from './watch'

import type { LogLevel } from './logger'

/**
 * build options
 */
interface Options {
  /**
   * Specify config file path, relative to cwd
   * if not specified, will try to find `velite.config.{js,ts,mjs,mts,cjs,cts}` in cwd or parent directories
   */
  config?: string
  /**
   * Clean output directories before build
   * @default false
   */
  clean?: boolean
  /**
   * Watch files and rebuild on changes
   * @default false
   */
  watch?: boolean
  /**
   * Log level
   * @default 'info'
   */
  logLevel?: LogLevel
}

/**
 * build contents
 * @param options build options
 */
export const build = async (options: Options = {}): Promise<Record<string, unknown>> => {
  const begin = performance.now()
  const { config: configFile, clean, logLevel } = options
  logLevel != null && logger.set(logLevel)
  await init(configFile, clean)
  const result = await resolve()
  logger.info(`build finished`, begin)
  options.watch && watch()
  return result
}
