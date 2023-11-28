import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, normalize, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { VFile } from 'vfile'
import { reporter } from 'vfile-reporter'

import { clearCache } from './cache'
import { resolveConfig } from './config'
import { resolveLoader } from './loaders'
import { logger } from './logger'

import type { Config } from './config'
import type { LogLevel } from './logger'
import type { ZodType } from 'zod'

interface Entry {
  [key: string]: any
}

/**
 * build result, may be one or more entries in a document file
 */
interface Result {
  [name: string]: Entry | Entry[]
}

/**
 * build options
 */
interface Options {
  /**
   * Specify config file path
   * @default 'velite.config.{js,ts,mjs,mts,cjs,cts}'
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
   * Production mode
   * @default false
   */
  production?: boolean
  /**
   * Log level
   * @default 'info'
   */
  logLevel?: LogLevel
}

const result: Result = {}
const emitted = new Map<string, string>()

/**
 * write file if content changed, reduce disk IO and improve fast refresh in app
 * @param path file path
 * @param content file data
 */
const emit = async (path: string, content: string): Promise<void> => {
  if (emitted.get(path) === content) return
  await writeFile(path, content)
  logger.log(`wrote '${path}' with ${content.length} bytes`)
  emitted.set(path, content)
}

/**
 * parse file with given schema
 * @param path file path
 * @param schema Zod schema
 * @returns file instance with parsed data
 */
const parse = async (path: string, schema: ZodType): Promise<VFile> => {
  const file = new VFile({ path })
  try {
    file.value = await readFile(file.path, 'utf8')

    if (file.extname == null) {
      throw new Error('can not parse file without extension')
    }

    const loader = resolveLoader(file.path)
    if (loader == null) {
      throw new Error(`no loader found for '${file.path}'`)
    }

    // logger.log(`load file '${file.path}' with '${loader.name}' loader`)

    // load original data
    const original = await loader.load(file)

    if (original == null || Object.keys(original).length === 0) {
      throw new Error('no data parsed from this file')
    }

    // there may be one or more records in one file, such as yaml array or json array
    const isArr = Array.isArray(original)
    const list = isArr ? original : [original]

    const processed = await Promise.all(
      list.map(async (item, index) => {
        // provide path for error reporting & relative path for reference
        const path: (string | number)[] = [file.path]
        // only push index if list has more than one item
        isArr && path.push(index)
        // parse data with given schema
        const result = await schema.safeParseAsync(item, { path })
        if (result.success) return result.data
        // report error if parsing failed
        result.error.issues.forEach(issue => {
          file.message(issue.message, { source: issue.path.slice(1).join('.') })
        })
      })
    )

    // set parsed data to file
    file.data.parsed = isArr ? processed[0] : processed
  } catch (err: any) {
    file.message(err.message)
  }
  return file
}

/**
 * load collections from content root
 * @param config resolved config
 * @returns loaded entries
 */
const load = async ({ root, output, collections, prepare, complete }: Config, changed?: string): Promise<Result> => {
  const begin = performance.now()

  logger.log(`loading collections in '${root}'`)

  // clear cache
  clearCache()

  const tasks = Object.entries(collections).map(async ([name, collection]) => {
    if (changed != null && !micromatch.isMatch(changed, collection.pattern)) {
      // skip collection if changed file not match
      // TODO: rebuild only changed file ???
      const prev = result[name]
      if (prev != null) {
        logger.log(`skipped load '${name}', using cached data`)
        return [name, prev] as const
      }
    }

    const filenames = await glob(collection.pattern, { cwd: root, onlyFiles: true, ignore: ['**/_*'], absolute: true })
    logger.log(`loading ${filenames.length} ${name} matching '${collection.pattern}'`)

    const files = await Promise.all(filenames.map(filename => parse(normalize(filename), collection.schema)))

    // report if any error in parsing
    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(report)

    // prettier-ignore
    const data = files.map(file => file.data.parsed).flat().filter(Boolean) as Entry[]

    if (collection.single) {
      if (data.length === 0) {
        throw new Error(`parsed ${data.length} items for '${name}', but expected only one`)
      } else if (data.length > 1) {
        logger.warn(`parsed ${data.length} items for '${name}', but expected only one, using first one`)
      }
      logger.log(`parsed single item for '${name}'`)
      return [name, data[0]] as const
    }

    logger.log(`parsed ${data.length} items for '${name}'`)
    return [name, data] as const
  })

  const entities = await Promise.all(tasks)
  let prevent = false

  // apply prepare hook
  if (typeof prepare === 'function') {
    const flag = await prepare(result as Record<string, any>)
    if (flag === false) prevent = true
    logger.log(`executed 'prepare' callback got ${flag == null ? 'no' : flag} result`)
  }

  if (prevent) {
    logger.warn(`prevent output by 'prepare' callback`)
  } else {
    // emit result if not prevented
    const logs: string[] = []

    await Promise.all(
      Object.entries(result).map(async ([name, data]) => {
        if (data == null) return
        const target = join(output.data, name + '.json')
        await emit(target, JSON.stringify(data, null, 2))
        logs.push(`${data.length ?? 1} ${name}`)
      })
    )

    logger.info(`output ${logs.join(', ')} and entry file`)
  }

  // call complete hook
  if (typeof complete === 'function') {
    await complete()
    logger.log(`executed 'complete' callback`)
  }

  Object.assign(result, Object.fromEntries(entities))

  logger.log(`loaded ${entities.length} collections in ${(performance.now() - begin).toFixed(2)}ms`)

  return result
}

/**
 * initialize
 * @param configFile specify config file path
 * @param clean clean output directories
 * @param logLevel log level
 * @returns resolved config
 */
const init = async (configFile?: string, clean?: boolean, logLevel?: LogLevel): Promise<Config> => {
  const begin = performance.now()
  // resolve config
  const config = await resolveConfig({ path: configFile, clean, logLevel })
  const { configPath, output, collections } = config

  // prerequisite
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

  // generate entry from config.collections
  const configModPath = relative(output.data, configPath)
    .replace(/\\/g, '/') // replace windows path separator
    .replace(/\.[mc]?[jt]s$/i, '') // remove extension

  const entry: string[] = []
  const dts: string[] = [`import config from '${configModPath}'\n`]

  Object.entries(collections).map(([name, collection]) => {
    const funcName = `get${name[0].toUpperCase() + name.slice(1)}` // getPosts
    entry.push(`export const ${funcName} = async () => await import('./${name}.json').then(m => m.default)\n`)
    dts.push(`export type ${collection.name} = NonNullable<typeof config.collections>['${name}']['schema']['_output']`)
    dts.push(`export declare const ${funcName}: () => Promise<${collection.name + (collection.single ? '' : '[]')}>\n`)
  })

  const banner = '// This file is generated by Velite\n\n'

  const entryFile = join(output.data, 'index.js')
  await emit(entryFile, banner + entry.join('\n'))
  logger.log(`created entry file in '${entryFile}'`)

  const dtsFile = join(output.data, 'index.d.ts')
  await emit(dtsFile, banner + dts.join('\n'))
  logger.log(`created entry dts file in '${dtsFile}'`)

  logger.log(`initialized in ${(performance.now() - begin).toFixed(2)}ms`)

  return config
}

/**
 * watch files and rebuild on changes
 * @param config resolved config
 */
const watch = async (config: Config) => {
  const { watch } = await import('chokidar')
  logger.info(`watching for changes in '${config.root}'`)

  const files = Object.values(config.collections).map(schema => schema.pattern)
  files.push(config.configPath) // watch config file changes

  watch(files, {
    cwd: config.root,
    ignored: /(^|[\/\\])[\._]./, // ignore dot & underscore files
    ignoreInitial: true, // ignore initial scan
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 }
  }).on('all', async (event, filename) => {
    if (filename == null) return
    const start = Date.now()

    if (filename === relative(config.root, config.configPath)) {
      // reload config if config file changed
      logger.info(`config changed '${filename}', reloading...`)
      try {
        Object.assign(config, await init(config.configPath, config.output.clean))
      } catch (err) {
        logger.warn(err)
        return
      }
    } else {
      logger.info(`file changed '${filename}', rebuilding...`)
    }

    try {
      await load(config, filename)
    } catch (err) {
      logger.warn(err)
    }

    logger.info(`rebuild finished in ${Date.now() - start}ms`)
  })
}

/**
 * build contents
 * @param options build options
 */
export const build = async (options: Options = {}): Promise<Result> => {
  const start = Date.now()
  const { config: configFile, clean, logLevel } = options

  const config = await init(configFile, clean, logLevel)
  const result = await load(config)

  logger.info(`build finished in ${Date.now() - start}ms`)

  // watch files
  options.watch && watch(config)

  return result
}
