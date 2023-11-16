/**
 * @file Builder
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import glob from 'fast-glob'
import { reporter } from 'vfile-reporter'

import { resolveConfig } from './config'
import { File } from './file'
import { addLoader } from './loaders'
import { initOutputConfig } from './shared'

import type { Config } from './types'

interface Options {
  config?: string
  clean?: boolean
  verbose?: boolean
}

class Builder {
  private readonly config: Config
  private readonly result: Record<string, Record<string, any> | Record<string, any>[]>

  constructor(config: Config) {
    this.config = config
    this.result = {}
  }

  async build() {
    if (this.config == null) throw new Error('config not initialized')
    const { root, verbose, schemas, onSuccess } = this.config

    verbose && console.log(`searching files in '${root}'`)

    const tasks = Object.entries(schemas).map(async ([name, schema]) => {
      const filenames = await glob(schema.pattern, { cwd: root, onlyFiles: true, ignore: ['**/_*'] })
      verbose && console.log(`found ${filenames.length} files matching '${schema.pattern}'`)

      const files = await Promise.all(
        filenames.map(async file => {
          const doc = await File.create(join(root, file))
          await doc.load()
          await doc.parse(schema.fields)
          return doc
        })
      )

      const report = reporter(files, { quiet: true, verbose })
      report.length > 0 && console.log(report)

      const data = files
        .map(f => f.data.result ?? [])
        .flat()
        .filter(Boolean)

      if (schema.single) {
        if (data.length > 1) {
          throw new Error(`found ${data.length} items for '${name}', but expected only one`)
        }
        return [name, data[0]] as const
      }

      return [name, data] as const
    })

    const collections = await Promise.all(tasks)

    const result = Object.fromEntries<any>(collections)

    // user callback
    onSuccess != null && (await onSuccess(result))

    Object.assign(this.result, result)
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

  async watch() {}

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

    // // ensure output directories exist
    // await mkdir(config.output.data, { recursive: true })
    // await mkdir(config.output.static, { recursive: true })
    // config.verbose && console.log('ensured output directories')

    return new Builder(config)
  }
}

export const build = async (options: Options) => {
  const builder = await Builder.create(options)
  await builder.build()
  await builder.output()
}
