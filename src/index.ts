import { createEngine } from './app/engine'
import { createWatcher } from './app/watch'

import type { Options } from './app/types'
import type { Watcher } from './app/watch'

export type { BlurOptions, Image } from './assets'
export type { Collection, Collections, CollectionType, Result } from './collections'
export type { Config, HookContext, PluginConfig, UserConfig } from './config'
export type { Loader } from './loaders/types'
export type { Output } from './output'
export type { SessionStore, StoreKey } from './runtime/store'
export type { MarkdownOptions } from './schemas/markdown'
export type { MdxOptions } from './schemas/mdx'
export type { Options, Watcher }

export { getImageMetadata, isRelativePath } from './assets'
export { defineCollection } from './collections'
export { VeliteFile } from './collections/file'
export { defineConfig } from './config'
export { defineLoader } from './loaders/types'
export { context } from './runtime/context'
export { createLogger, logger } from './runtime/logger'
export * from './schemas'

/**
 * Build all collections defined in the user config.
 *
 * Each call creates a fresh build engine and (for `watch: true`) a watch
 * controller. The public return shape is preserved as `Record<string, unknown>`.
 */
export const build = async (options: Options = {}): Promise<Record<string, unknown>> => {
  const engine = createEngine()
  const result = await engine.build(options)
  if (options.watch === true) {
    const controller = createWatcher()
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
  const engine = createEngine()
  await engine.build({ ...options, watch: false })
  const controller = createWatcher()
  return await controller.start(engine, options)
}
