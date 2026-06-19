import { createEngine } from './app/engine'
import { createWatcher } from './app/watch'

import type { BuildOptions } from './app/types'
import type { Watcher } from './app/watch'

export type { BuildOptions } from './app/types'
export type { BlurOptions, VeliteImage } from './assets'
export type { BuildResult, Collection, Collections, CollectionType } from './collections'
export type { HookContext, PluginConfig, ResolvedConfig, UserConfig } from './config'
export type { VeliteLoader } from './loaders/types'
export type { VeliteOutput } from './output'
export type { BuildContext, ContentFile } from './runtime/context'
export type { LogLevel } from './runtime/logger'
export type { BuildStore, StoreKey } from './runtime/store'
export type { infer, VeliteSchema } from './schemas'
export type { MarkdownOptions } from './schemas/markdown'
export type { MdxOptions } from './schemas/mdx'
export type { Watcher }

export { getImageMetadata } from './assets'
export { defineCollection } from './collections'
export { defineConfig } from './config'
export { defineLoader } from './loaders/types'
export { context } from './runtime/context'
export { defineSchema, s } from './schemas'

/**
 * Build all collections defined in the user config.
 *
 * Each call creates a fresh build engine and (for `watch: true`) a watch
 * controller. The public return shape is preserved as `Record<string, unknown>`.
 */
export const build = async (options: BuildOptions = {}): Promise<Record<string, unknown>> => {
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
export const watch = async (options: BuildOptions = {}): Promise<Watcher> => {
  const engine = createEngine()
  await engine.build({ ...options, watch: false })
  const controller = createWatcher()
  return await controller.start(engine, options)
}
