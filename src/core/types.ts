import type { LogLevel } from './logger'

/**
 * Build options for `build()` and the internal engine.
 */
export interface Options {
  /**
   * Specify config file path, relative to cwd.
   * If not specified, will try to find `velite.config.{js,ts,mjs,mts,cjs,cts}`
   * in cwd or parent directories.
   */
  config?: string
  /**
   * Clean output directories before build.
   * @default false
   */
  clean?: boolean
  /**
   * Watch files and rebuild on changes.
   * @default false
   */
  watch?: boolean
  /**
   * Log level.
   * @default 'info'
   */
  logLevel?: LogLevel
  /**
   * If true, throws an error and terminates the process when any schema
   * validation fails.
   * @default false
   */
  strict?: boolean
}
