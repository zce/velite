import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import reporter from 'vfile-reporter'

import { cache } from './cache'
import { resolveConfig } from './config'
import { File, load, report } from './file'
import { logger } from './logger'

import type { LogLevel } from './logger'
import type { CollectionName, CollectionResult, ResolvedConfig, Result } from './types'

// const tree = new Map<string, { [path: string]: File }>()

/**
 * emit file if content changed, reduce disk IO and improve fast refresh in app
 * @param path file path
 * @param content file data
 * @param log log message
 */
const emit = async (path: string, content: string, log?: string): Promise<void> => {
  if (cache.get(`emitted:${path}`) === content) {
    logger.log(`skipped write '${path}' with same content`)
    return
  }
  await writeFile(path, content)
  logger.log(log ?? `wrote '${path}' with ${content.length} bytes`)
  cache.set(`emitted:${path}`, content)
}

/**
 * initialize
 * @param configFile specify config file path
 * @param clean clean output directories
 * @returns resolved config
 */
const init = async (configFile?: string, clean?: boolean): Promise<ResolvedConfig> => {
  const begin = performance.now()

  const config = await resolveConfig(configFile, clean)
  const { configPath, output, collections } = config

  if (output.clean) {
    // clean output directories if `--clean` requested
    await rm(output.data, { recursive: true, force: true })
    logger.log(`cleaned data output dir '${output.data}'`)

    await rm(output.assets, { recursive: true, force: true })
    logger.log(`cleaned assets output dir '${output.assets}'`)
  }

  // create output directories if not exists
  await mkdir(output.data, { recursive: true })
  await mkdir(output.assets, { recursive: true })

  // generate entry according to `config.collections`
  const configModPath = relative(output.data, configPath)
    .replace(/\\/g, '/') // replace windows path separator
    .replace(/\.[mc]?[jt]s$/i, '') // remove extension

  const entry: string[] = []
  const dts: string[] = [`import config from '${configModPath}'\n`]

  Object.entries(collections).map(([name, collection]) => {
    const funcName = `get${name[0].toUpperCase() + name.slice(1)}` // e.g. getPosts
    entry.push(`export const ${funcName} = async () => await import('./${name}.json').then(m => m.default)\n`)
    dts.push(`export type ${collection.name} = NonNullable<typeof config.collections>['${name}']['schema']['_output']`)
    dts.push(`export declare const ${funcName}: () => Promise<${collection.name + (collection.single ? '' : '[]')}>\n`)
  })

  const banner = '// This file is generated by Velite\n\n'

  const entryFile = join(output.data, 'index.js')
  await emit(entryFile, banner + entry.join('\n'), `created entry file in '${entryFile}'`)

  const dtsFile = join(output.data, 'index.d.ts')
  await emit(dtsFile, banner + dts.join('\n'), `created entry dts file in '${dtsFile}'`)

  logger.log(`initialized`, begin)

  return config
}

/**
 * resolve collections from content root
 * @param config resolved config
 * @param changed changed file path (relative to content root)
 * @returns resolved entries
 */
const resolve = async ({ root, output, collections, prepare, complete }: ResolvedConfig, changed?: string): Promise<Record<string, unknown>> => {
  // 1. resolve each collection
  // 1.1. get all files matching pattern
  // 1.2. load & parse & validate file
  // 2. apply prepare hook
  // 3. copy assets
  // 3. emit result
  // 4. apply complete hook
  const begin = performance.now()
  // cache.clear('REFRESH') // clear need refresh cache
  logger.log(`resolving collections from '${root}'`)
  const tasks = Object.entries(collections).map(async ([name, { pattern, schema, single }]): Promise<[string, any]> => {
    const begin = performance.now()
    const paths = await glob(pattern, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
    logger.log(`resolve ${paths.length} files matching '${pattern}'`)
    const files = await Promise.all(paths.map(path => load(path, schema)))
    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(`${name}:\n${report}`)
    const data = files.flatMap(file => file.result).filter(Boolean)
    if (single) {
      if (data.length === 0) throw new Error(`no data resolved for '${name}'`)
      if (data.length > 1) logger.warn(`resolved ${data.length} ${name}, but expected single, using first one`)
      else logger.log(`resolved 1 ${name}`, begin)
      return [name, data[0]]
    }
    logger.log(`resolved ${data.length} ${name}`, begin)
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
    const begin = performance.now()
    // emit result if not prevented
    const logs: string[] = []
    await Promise.all(
      Object.entries(result).map(async ([name, data]) => {
        if (data == null) return
        const target = join(output.data, name + '.json')
        // TODO: output each record separately to a single file to improve fast refresh performance in app
        await emit(target, JSON.stringify(data, null, 2), `wrote '${target}' with ${data.length ?? 1} ${name}`)
        logs.push(`${data.length ?? 1} ${name}`)
      })
    )
    logger.info(`output ${logs.join(', ')}`, begin)
  } else {
    logger.warn(`prevent output by 'prepare' callback`)
  }
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
 * @param config resolved config
 */
const watch = async (config: ResolvedConfig) => {
  const { watch } = await import('chokidar')
  logger.info(`watching for changes in '${config.root}'`)

  const files = Object.values(config.collections).map(schema => schema.pattern)
  files.push(config.configPath) // watch config file changes

  watch(files, {
    cwd: config.root,
    ignored: /(^|[\/\\])[\._]./, // ignore dot & underscore files
    ignoreInitial: true, // ignore initial scan
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  }).on('all', async (_, filename) => {
    if (filename == null) return
    const begin = performance.now()
    filename = join(config.root, filename)
    try {
      if (filename === config.configPath) {
        // reload config if config file changed
        logger.info(`config changed '${filename}', reloading...`)
        await resolve(await init(config.configPath, false))
        // TODO: need rewatch files if config file changed
        // const newConfig = await init(config.configPath, config.output.clean)
        // await resolve(newConfig)
        // const newFiles = Object.values(config.collections).map(schema => schema.pattern)
        // newFiles.push(config.configPath) // watch config file changes
        // watcher.unwatch(files).add(newFiles)
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
  // set log level
  logLevel != null && logger.set(logLevel)
  const config = await init(configFile, clean)
  const result = await resolve(config)
  logger.info(`build finished`, begin)
  // watch files
  options.watch && watch(config)
  return result
}
