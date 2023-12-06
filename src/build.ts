import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import reporter from 'vfile-reporter'

import { assets } from './assets'
import { cache } from './cache'
import { resolveConfig } from './config'
import { load } from './file'
import { logger } from './logger'
import { outputAssets, outputData, outputEntry } from './output'

import type { Config } from './config'
import type { LogLevel } from './logger'

/**
 * initialize config
 * @param configFile specify config file path
 * @param clean clean output directories
 * @returns resolved config
 */
const init = async (configFile?: string, clean?: boolean): Promise<Config> => {
  const begin = performance.now()

  const config = await resolveConfig(configFile, clean)
  const { configPath, output, collections } = config

  if (output.clean) {
    await rm(output.data, { recursive: true, force: true })
    logger.log(`cleaned data output dir '${output.data}'`)

    await rm(output.assets, { recursive: true, force: true })
    logger.log(`cleaned assets output dir '${output.assets}'`)
  }

  // create output directories if not exists
  await mkdir(output.data, { recursive: true })
  await mkdir(output.assets, { recursive: true })

  await outputEntry(output.data, configPath, collections)

  logger.log(`initialized`, begin)

  return config
}

// cache resolved result for rebuild
const resolved = new Map<string, unknown>()

/**
 * resolve collections from content root
 * @param config resolved config
 * @param changed changed file path (relative to content root)
 * @returns resolved result
 */
export const resolve = async ({ root, output, collections, prepare, complete }: Config, changed?: string): Promise<Record<string, unknown>> => {
  const begin = performance.now()

  cache.clear() // clear need refresh cache

  logger.log(`resolving collections from '${root}'`)

  const tasks = Object.entries(collections).map(async ([name, { pattern, schema, single }]): Promise<[string, any]> => {
    if (changed != null && !micromatch.contains(changed, pattern) && resolved.has(name)) {
      // skip collection if changed file not match
      logger.log(`skipped resolve '${name}', using previous resolved`)
      return [name, resolved.get(name)!]
    }

    const begin = performance.now()

    const paths = await glob(pattern, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
    logger.log(`resolve ${paths.length} files matching '${pattern}'`)

    const files = await Promise.all(paths.map(path => load(path, schema, changed)))

    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(`${name}:\n${report}`)

    const data = files.flatMap(file => file.result).filter(Boolean)

    if (single) {
      if (data.length === 0) throw new Error(`no data resolved for '${name}'`)
      if (data.length > 1) logger.warn(`resolved ${data.length} ${name}, but expected single, using first one`)
      else logger.log(`resolved 1 ${name}`, begin)
      resolved.set(name, data[0])
      return [name, data[0]]
    }

    logger.log(`resolved ${data.length} ${name}`, begin)
    resolved.set(name, data)
    return [name, data]
  })

  const result = Object.fromEntries(await Promise.all(tasks))

  let shouldOutput = true
  // apply prepare hook
  if (typeof prepare === 'function') {
    const begin = performance.now()
    shouldOutput = (await prepare(result)) ?? true
    logger.log(`executed 'prepare' callback got ${shouldOutput}`, begin)
  }

  if (shouldOutput) {
    // emit result if not prevented
    await outputData(output.data, result)
  } else {
    logger.warn(`prevent output by 'prepare' callback`)
  }

  // output all assets
  await outputAssets(output.assets, assets)

  // call complete hook
  if (typeof complete === 'function') {
    const begin = performance.now()
    await complete(result)
    logger.log(`executed 'complete' callback`, begin)
  }

  logger.log(`resolved ${Object.keys(result).length} collections`, begin)

  return result
}

/**
 * watch files and rebuild on changes
 */
const watch = async (config: Config) => {
  const { watch } = await import('chokidar')

  const { root, collections, configPath } = config

  logger.info(`watching for changes in '${root}'`)

  const files = Object.values(collections).map(({ pattern }) => pattern)
  files.push(configPath) // watch config file changes

  const watcher = watch(files, {
    cwd: root,
    ignored: /(^|[\/\\])[\._]./, // ignore dot & underscore files
    ignoreInitial: true, // ignore initial scan
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  }).on('all', async (event, filename) => {
    if (event === 'addDir' || event === 'unlinkDir') return // ignore dir changes
    if (filename == null) return
    const begin = performance.now()
    filename = join(root, filename)
    try {
      if (filename === configPath) {
        // reload config if config file changed
        logger.info(`config changed '${filename}', reloading...`)
        await resolve(await init(configPath, false))
        // TODO: need rewatch files if config file changed
        // watcher.unwatch('**').add(
        //   Object.values(context.collections)
        //     .map(({ pattern }) => pattern)
        //     .concat(context.configPath)
        // )
      } else {
        logger.info(`file changed '${filename}', rebuilding...`)
        await resolve(config, filename)
      }
    } catch (err) {
      logger.warn(err)
    }

    logger.info(`rebuild finished`, begin)
  })
}

/**
 * Build options
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
  const config = await init(configFile, clean)
  const result = await resolve(config)
  logger.info(`build finished`, begin)
  options.watch && watch(config)
  return result
}
