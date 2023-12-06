import { mkdir, readFile, rm } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { VFile } from 'vfile'
import { reporter } from 'vfile-reporter'

import { assets } from './assets'
import { cache, loaded, resolved } from './cache'
import { resolveConfig } from './config'
import { resolveLoader } from './loaders'
import { logger } from './logger'
import { outputAssets, outputData, outputEntry } from './output'

import type { ZodSchema } from 'zod'
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

/**
 * Load file and parse data with given schema
 * @param path file path
 * @param schema data schema
 * @param changed changed file path (relative to content root)
 */
export const load = async (path: string, schema: ZodSchema, changed?: string): Promise<VFile> => {
  path = normalize(path)
  if (changed != null && path !== changed && loaded.has(path)) {
    // skip file if changed file not match
    logger.log(`skipped load '${path}', using previous loaded`)
    return loaded.get(path)!
  }

  const begin = performance.now()

  const loader = resolveLoader(path)

  const file = new VFile({ path })
  if (loader == null) file.fail(`no loader found for '${path}'`)
  loaded.set(path, file)

  file.value = await readFile(file.path)
  file.data = await loader!.load(file)

  const { data } = file.data
  if (data == null) file.fail(`no data loaded from this file`)

  // may be one or more records in one file, such as yaml array or json array
  const isArr = Array.isArray(data)
  const list = isArr ? data : [data]
  const parsed = await Promise.all(
    list.map(async (item, index) => {
      // provide path for error reporting & relative path for reference
      const path: (string | number)[] = [file.path]
      // only push index if list has more than one item
      isArr && path.push(index)
      // parse data with given schema
      const result = await schema.safeParseAsync(item, { path })
      if (result.success) return result.data
      // report error if parsing failed
      result.error.issues.forEach(issue => file.message(issue.message, { source: issue.path.slice(1).join('.') }))
    })
  )

  logger.log(`loaded '${path}' with ${parsed.length} records`, begin)
  file.result = isArr ? parsed : parsed[0]
  return file
}

/**
 * resolve collections from content root
 * @param config resolved config
 * @param changed changed file path (relative to content root)
 * @returns resolved result
 */
const resolve = async ({ root, output, collections, prepare, complete }: Config, changed?: string): Promise<Record<string, unknown>> => {
  const begin = performance.now()

  cache.clear() // clear need refresh cache

  logger.log(`resolving collections from '${root}'`)

  const entries = await Promise.all(
    Object.entries(collections).map(async ([name, { pattern, schema }]): Promise<[string, VFile[]]> => {
      if (changed != null && !micromatch.contains(changed, pattern) && resolved.has(name)) {
        // skip collection if changed file not match
        logger.log(`skipped resolve '${name}', using previous resolved`)
        return [name, resolved.get(name)!]
      }
      const begin = performance.now()
      const paths = await glob(pattern, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
      logger.log(`resolve ${paths.length} files matching '${pattern}'`, begin)
      const files = await Promise.all(paths.map(path => load(path, schema, changed)))
      resolved.set(name, files)
      return [name, files]
    })
  )

  const allFiles = entries.flatMap(([, files]) => files)
  const report = reporter(allFiles, { quiet: true })
  report.length > 0 && logger.warn(`issues:\n${report}`)

  const result = Object.fromEntries(
    entries.map(([name, files]): [string, any | any[]] => {
      const data = files.flatMap(file => file.result).filter(Boolean)
      if (collections[name].single) {
        if (data.length === 0) throw new Error(`no data resolved for '${name}'`)
        if (data.length > 1) logger.warn(`resolved ${data.length} ${name}, but expected single, using first one`)
        else logger.log(`resolved 1 ${name}`)
        return [name, data[0]]
      }
      logger.log(`resolved ${data.length} ${name}`)
      return [name, data]
    })
  )

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
        const config = await init(configPath, false)
        await resolve(config)
        // TODO: need rewatch files if config file changed
        watcher.unwatch('**').add(
          Object.values(config.collections)
            .map(({ pattern }) => pattern)
            .concat(config.configPath)
        )
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
