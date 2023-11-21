import { mkdir, rm, watch, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { reporter } from 'vfile-reporter'

import { clearCache } from './cache'
import { getConfig, resolveConfig } from './config'
import { File } from './file'
import { logger, LogLevel, setLogLevel } from './logger'

import type { Collections } from './types'

export interface BuildOptions {
  config?: string
  clean?: boolean
  watch?: boolean
  logLevel?: LogLevel
}

class Builder {
  private readonly options: BuildOptions
  private readonly result: Collections

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
    const config = await resolveConfig({ filename, clean })

    // prerequisite

    if (config.clean) {
      // clean output directories if `--clean` requested
      await rm(config.output.data, { recursive: true, force: true })
      logger.log(`cleaned data output dir '${config.output.data}'`)

      // rm static dir not safe, so rm only the output file dir
      const outputStaticDir = dirname(join(config.output.static, config.output.filename))
      await rm(outputStaticDir, { recursive: true, force: true })
      logger.log(`cleaned static output dir '${outputStaticDir}'`)
    }
    await mkdir(config.output.data, { recursive: true })
    logger.log('created data output directories')
  }

  /**
   * generate entry from config.schemas
   * @returns entry content and dts
   */
  private async generateEntry() {
    const { configPath, output, schemas } = getConfig()
    const configRelPath = relative(output.data, normalize(configPath))
      .replace(/\\/g, '/')
      .replace(/\.(js|cjs|mjs|ts|cts|mts)$/, '')
    const entry: string[] = []
    const dts: string[] = [`import config from '${configRelPath}'\n`]
    Object.entries(schemas).map(([name, schema]) => {
      const type = schema.name + (schema.single ? '' : '[]')
      entry.push(`export const ${name} = async () => await import('./${name}.json').then(m => m.default)`)
      dts.push(`export type ${schema.name} = NonNullable<typeof config.schemas>['${name}']['fields']['_output']`)
      dts.push(`export declare const ${name}: () => Promise<${type}>`)
    })
    return [entry.join('\n'), dts.join('\n')] as const
  }

  /**
   * output result to dist
   */
  private async output() {
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
   * build content with config
   * @param changed changed file path
   */
  async build(changed?: string) {
    logger.log(`start ${changed == null ? 'building' : 'rebuilding'}...`)

    const { root, schemas, onSuccess } = getConfig()

    logger.log(`searching files in '${root}'`)

    // clear cache if rebuilding
    clearCache()
    logger.log('cleared memory cache')

    const files: File[] = []

    const tasks = Object.entries(schemas).map(async ([name, schema]) => {
      if (changed != null && !micromatch.isMatch(changed, schema.pattern)) {
        // skip schema if changed file not match
        // TODO: rebuild only changed file ???
        const data = this.result[name]
        if (data != null) {
          logger.log(`skipped '${name}', using cached data`)
          return [name, data] as const
        }
      }

      const filenames = await glob(schema.pattern, { cwd: root, onlyFiles: true, ignore: ['**/_*'] })
      logger.log(`found ${filenames.length} files matching '${schema.pattern}'`)

      const result = await Promise.all(
        filenames.map(async filename => {
          const file = await File.create(join(root, filename))
          const result = await file.parse(schema.fields)
          files.push(file)
          return result
        })
      )

      const data = result.flat().filter(Boolean)

      logger.log(`parsed ${data.length} items for '${name}'`)

      if (schema.single) {
        if (data.length > 1) {
          logger.warn(`parsed ${data.length} items for '${name}', but expected only one`)
        }
        return [name, data[0]] as const
      }

      return [name, data] as const
    })

    const entities = await Promise.all(tasks)

    // report if any error in parsing
    const report = reporter(files, { quiet: true })
    report.length > 0 && logger.warn(report)

    const collections = Object.fromEntries<any>(entities)

    // user callback
    if (typeof onSuccess === 'function') {
      await onSuccess(collections)
      logger.log(`executed config.onSuccess callback`)
    }

    Object.assign(this.result, collections)

    await this.output()

    logger.info(`finished ${changed == null ? 'building' : 'rebuilding'}`)
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
    const { root, schemas } = getConfig()
    const allPatterns = Object.values(schemas).map(schema => schema.pattern)

    logger.info(`watching for changes in '${root}'`)

    for await (const event of watch(root, { recursive: true })) {
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
