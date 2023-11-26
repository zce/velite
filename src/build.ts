import { mkdir, rm, watch, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { reporter } from 'vfile-reporter'

import { clearCache } from './cache'
import { getConfig, resolveConfig } from './config'
import { File } from './file'
import { logger, LogLevel, setLogLevel } from './logger'

import type { Data } from './types'

export interface BuildOptions {
  config?: string
  clean?: boolean
  watch?: boolean
  logLevel?: LogLevel
}

class Builder {
  private readonly options: BuildOptions
  private readonly result: Record<string, Data>

  constructor(options: BuildOptions) {
    this.options = options
    this.result = {}
  }

  /**
   * init builder config
   */
  async init() {
    const { config: filename, clean, logLevel } = this.options

    // set log level
    logLevel && setLogLevel(logLevel)

    // resolve config
    const { output } = await resolveConfig({ filename, clean })

    // prerequisite

    if (output.clean) {
      // clean output directories if `--clean` requested
      await rm(output.data, { recursive: true, force: true })
      logger.log(`cleaned data output dir '${output.data}'`)

      // rm static dir not safe, so rm only the output file dir
      const outputStaticDir = dirname(join(output.static, output.filename))
      await rm(outputStaticDir, { recursive: true, force: true })
      logger.log(`cleaned static output dir '${outputStaticDir}'`)
    }
    await mkdir(output.data, { recursive: true })
    logger.log('created data output directories')
  }

  /**
   * generate entry from config.collections
   * @returns entry content and dts
   */
  private async generateEntry() {
    const { configPath, output, collections } = getConfig()
    const configRelPath = relative(output.data, normalize(configPath))
      .replace(/\\/g, '/')
      .replace(/\.(js|cjs|mjs|ts|cts|mts)$/, '')
    const entry: string[] = []
    const dts: string[] = [`import config from '${configRelPath}'\n`]
    Object.entries(collections).map(([name, collection]) => {
      entry.push(`export const ${name} = async () => await import('./${name}.json').then(m => m.default)`)
      dts.push(`export type ${collection.name} = NonNullable<typeof config.collections>['${name}']['schema']['_output']`)
      dts.push(`export declare const ${name}: () => Promise<${collection.name + (collection.single ? '' : '[]')}>`)
    })
    return [entry.join('\n'), dts.join('\n')] as const
  }

  /**
   * emit result to dist
   */
  private async emit() {
    const { output } = getConfig()
    const logs: string[] = []
    await Promise.all(
      Object.entries(this.result).map(async ([name, data]) => {
        if (data == null) return
        const dest = join(output.data, name + '.json')
        await writeFile(dest, JSON.stringify(data, null, 2))
        logger.log(`wrote ${data.length ?? 1} ${name} in '${dest}'`)
        logs.push(`${data.length ?? 1} ${name}`)
      })
    )

    const [enery, dts] = await this.generateEntry()

    const entryFile = join(output.data, 'index.js')
    await writeFile(entryFile, enery)
    logger.log(`wrote entry file in '${entryFile}'`)

    const dtsFile = join(output.data, 'index.d.ts')
    await writeFile(dtsFile, dts)
    logger.log(`wrote entry dts file in '${dtsFile}'`)

    logger.info(`output ${logs.join(', ')} and entry file`)
  }

  /**
   * done building
   */
  private async done() {
    const { prepare, complete } = getConfig()
    let prevent = false

    // apply prepare hook
    if (typeof prepare === 'function') {
      const flag = await prepare(this.result as any)
      if (flag === false) {
        prevent = true
      }
      logger.log(`executed 'prepare' callback got ${flag == null ? 'no' : flag} result`)
    }

    if (prevent === false) {
      // emit result if not prevented
      await this.emit()
    } else {
      logger.warn(`prevent output by 'prepare' callback`)
    }

    // call complete hook
    if (typeof complete === 'function') {
      await complete()
      logger.log(`executed 'complete' callback`)
    }
  }

  /**
   * load files and parse data
   * @param changed changed file path
   */
  private async load(changed?: string) {
    const { root, collections } = getConfig()

    logger.log(`searching files in '${root}'`)

    const files: File[] = []

    const tasks = Object.entries(collections).map(async ([name, collection]) => {
      if (changed != null && !micromatch.isMatch(changed, collection.pattern)) {
        // skip schema if changed file not match
        // TODO: rebuild only changed file ???
        const prev = this.result[name]
        if (prev != null) {
          logger.log(`skipped '${name}', using cached data`)
          return [name, prev] as const
        }
      }

      const filenames = await glob(collection.pattern, { cwd: root, onlyFiles: true, ignore: ['**/_*'] })
      logger.log(`found ${filenames.length} files matching '${collection.pattern}'`)

      const result = await Promise.all(
        filenames.map(async filename => {
          const file = await File.create(join(root, filename))
          const data = await file.parse(collection.schema)
          files.push(file)
          return data
        })
      )

      const data = result.flat().filter(Boolean)

      logger.log(`parsed ${data.length} items for '${name}'`)

      if (collection.single) {
        if (data.length > 1) {
          logger.warn(`parsed ${data.length} items for '${name}', but expected only one`)
        }
        return [name, data[0]] as const
      }

      return [name, data] as const
    })

    const entities = await Promise.all(tasks)

    Object.assign(this.result, Object.fromEntries(entities))

    // report if any error in parsing
    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(report)
  }

  /**
   * build content
   * @param changed changed file path
   */
  async build(changed?: string) {
    const start = Date.now()
    logger.log(`start ${changed == null ? 'build' : 'rebuild'}ing...`)

    // clear cache if rebuilding
    clearCache()
    logger.log('cleared memory cache')

    await this.load(changed)
    await this.done()

    logger.info(`build complete in ${Date.now() - start}ms`)
  }

  /**
   * watch config file changes and reinit builder
   */
  private async watchConfig() {
    const { configPath } = getConfig()

    logger.info(`watching for changes in '${configPath}'`)

    for await (const event of watch(configPath)) {
      const { filename } = event
      if (filename == null) continue

      logger.info(`config changed '${filename}', rebuilding...`)

      await this.init()
        .then(() => this.build())
        .catch(logger.warn)
    }
  }

  /**
   * watch content files changes and rebuild
   */
  private async watchRoot() {
    const { root, collections } = getConfig()
    const allPatterns = Object.values(collections).map(schema => schema.pattern)

    logger.info(`watching for changes in '${root}'`)

    // TOOD: recursive watch not working on linux
    // The `fs.watch()` recursive option is only supported on macOS and Windows.
    // Maybe Chokidar is a better choice.
    // https://github.com/nodejs/node/issues/36005
    for await (const event of watch(root, { recursive: process.platform !== 'linux' })) {
      const { filename } = event
      if (filename == null) continue
      if (!allPatterns.some(pattern => micromatch.isMatch(filename, pattern))) continue

      logger.info(`file changed '${filename}', rebuilding...`)

      await this.build(filename).catch(logger.warn)
    }
  }

  /**
   * start watching
   */
  watch() {
    // logger.clear()
    this.watchConfig()
    this.watchRoot()
  }
}

export const build = async (options: BuildOptions = {}) => {
  const builder = new Builder(options)
  await builder.init()
  await builder.build()
  options.watch && builder.watch()
}
