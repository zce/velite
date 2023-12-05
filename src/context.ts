import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveConfig } from './config'
import { logger } from './logger'
import { outputEntry } from './output'

import type { Collections, Config, Loader, MarkdownOptions, MdxOptions, Output, PluginConfig } from './config'

/**
 * Build Context
 */
export interface Context extends Partial<PluginConfig> {
  /**
   * Velite cache
   * @description
   * memory level cache is enough for Velite. and it's easy & efficient.
   * maybe we can use other cache way in the future if needed.
   * but for now, we just need a simple cache.
   */
  cache: Map<string, any>
  /**
   * context file path
   */
  configPath: string
  /**
   * The root directory of the contents (relative to config file).
   * @default 'content'
   */
  root: string
  /**
   * Output configuration
   */
  output: Output
  /**
   * All collections
   */
  collections: Collections
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   * @param data loaded data
   */
  prepare?: Config['prepare']
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param data loaded data
   */
  complete?: Config['complete']
}

/**
 * get context, require `init` called before
 */
export const context: Context = {} as any // unreasonable, but convenient

/**
 * initialize context
 * @param configFile specify config file path
 * @param clean clean output directories
 * @returns context
 */
export const init = async (configFile?: string, clean?: boolean): Promise<Context> => {
  const begin = performance.now()
  const { path, config } = await resolveConfig(configFile, clean)

  logger.log(`using config '${path}'`, begin)

  const cwd = dirname(path)

  const { output, collections } = Object.assign(context, config, {
    cache: new Map(),
    configPath: path,
    root: resolve(cwd, config.root ?? 'content'),
    output: {
      data: resolve(cwd, config.output?.data ?? '.velite'),
      assets: resolve(cwd, config.output?.assets ?? 'public/static'),
      base: config.output?.base ?? '/static/',
      filename: config.output?.filename ?? '[name]-[hash:8].[ext]',
      ignore: config.output?.ignore ?? [],
      clean: clean ?? config.output?.clean ?? false
    }
  })

  if (output.clean) {
    await rm(output.data, { recursive: true, force: true })
    logger.log(`cleaned data output dir '${output.data}'`)

    await rm(output.assets, { recursive: true, force: true })
    logger.log(`cleaned assets output dir '${output.assets}'`)
  }

  // create output directories if not exists
  await mkdir(output.data, { recursive: true })
  await mkdir(output.assets, { recursive: true })

  // generate entry file
  await outputEntry(output.data, path, collections)

  logger.log(`context initialized`, begin)

  return context
}
