import { mkdir, rm, watch, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { reporter } from 'vfile-reporter'

import { resolveConfig } from './config'
import { cache, initOutputConfig } from './context'
import { File } from './file'
import { addLoader } from './loaders'

import type { Config } from './types'

interface Options {
  config?: string
  clean?: boolean
  watch?: boolean
  verbose?: boolean
}

class Builder {
  private readonly config: Config
  private readonly result: Record<string, Record<string, any> | Record<string, any>[]>

  constructor(config: Config) {
    this.config = config
    this.result = {}
  }

  /**
   * create builder instance
   */
  static async create(options: Options) {
    // resolve config
    const config = await resolveConfig({ filename: options.config, clean: options.clean, verbose: options.verbose })

    // register user loaders
    config.loaders.forEach(addLoader)

    // init static output config
    initOutputConfig(config.output)

    // prerequisite
    if (config.clean) {
      // clean output directories if `--clean` requested
      await rm(config.output.data, { recursive: true, force: true })
      await rm(config.output.static, { recursive: true, force: true })
      config.verbose && console.log('cleaned output directories')
    }

    return new Builder(config)
  }

  /**
   * output result to dist
   */
  async output() {
    const { output } = this.config

    await mkdir(output.data, { recursive: true })

    await Promise.all(
      Object.entries(this.result).map(async ([name, data]) => {
        if (data == null) return
        const json = JSON.stringify(data, null, 2)
        await writeFile(join(output.data, name + '.json'), json)
        console.log(`wrote ${data.length ?? 1} ${name} to '${join(output.data, name + '.json')}'`)
      })
    )
  }

  /**
   * build content with config
   */
  async build() {
    if (this.config == null) throw new Error('config not initialized')
    const { root, verbose, schemas, onSuccess } = this.config

    verbose && console.log(`searching files in '${root}'`)

    cache.clear() // clear cache in case of rebuild

    const files: File[] = []

    const tasks = Object.entries(schemas).map(async ([name, schema]) => {
      const filenames = await glob(schema.pattern, { cwd: root, onlyFiles: true, ignore: ['**/_*'] })
      verbose && console.log(`found ${filenames.length} files matching '${schema.pattern}'`)

      const result = await Promise.all(
        filenames.map(async filename => {
          const file = await File.create(join(root, filename))
          const result = await file.parse(schema.fields)
          files.push(file)
          return result
        })
      )

      const data = result.flat().filter(Boolean)

      if (schema.single) {
        if (data.length > 1) {
          throw new Error(`found ${data.length} items for '${name}', but expected only one`)
        }
        return [name, data[0]] as const
      }

      return [name, data] as const
    })

    const entities = await Promise.all(tasks)

    // report if any error in parsing
    const report = reporter(files, { quiet: true, verbose })
    report.length > 0 && console.log(report)

    const collections = Object.fromEntries<any>(entities)

    // user callback
    if (typeof onSuccess === 'function') {
      await onSuccess(collections)
    }

    Object.assign(this.result, collections)

    await this.output()
  }

  async watch() {
    console.log('watching for changes')

    const { schemas } = this.config
    const allPatterns = Object.values(schemas).map(schema => schema.pattern)

    const watcher = watch(this.config.root, { recursive: true })

    for await (const event of watcher) {
      const { filename } = event
      if (filename == null) continue
      if (!allPatterns.some(pattern => micromatch.isMatch(filename, pattern))) continue
      // rebuild all
      await this.build() // TODO: rebuild only changed file
    }
  }
}

export const build = async (options: Options) => {
  const builder = await Builder.create(options)
  await builder.build()
  if (!options.watch) return
  await builder.watch()
}
