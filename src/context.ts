import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveConfig } from './config'
import { logger } from './logger'
import { outputEntry } from './output'

import type { Config } from './config'

/**
 * Build Context
 */
export interface Context extends Readonly<Config> {
  /**
   * Velite cache
   * @description
   * memory level cache is enough for Velite. and it's easy & efficient.
   * maybe we can use other cache way in the future if needed.
   * but for now, we just need a simple cache.
   */
  readonly cache: Map<string, any>
  /**
   * context file path
   */
  readonly configPath: string
  /**
   * The root directory of the contents (relative to config file).
   * @default 'content'
   */
  readonly root: string
  /**
   * Output configuration
   */
  readonly output: Required<NonNullable<Config['output']>>
}

let _context: Context = null as any // unreasonable, but convenient

/**
 * global context, require `init` called before
 */
export const context = new Proxy<Context>(_context, {
  get: (target, prop: keyof Context) => {
    if (target?.[prop] != null) return target[prop]
    throw new Error('context not initialized')
  }
})

/**
 * initialize context
 * @param configFile specify config file path
 * @param clean clean output directories
 */
export const init = async (configFile?: string, clean?: boolean): Promise<void> => {
  const begin = performance.now()
  const { path, config } = await resolveConfig(configFile, clean)

  logger.log(`using config '${path}'`, begin)

  const cwd = dirname(path)

  const { output, collections } = (_context = {
    ...config,
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
}
