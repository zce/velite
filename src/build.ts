import { mkdir, rm, watch, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { reporter } from 'vfile-reporter'

import { resolveConfig } from './config'
import { cache, initOutputConfig } from './context'
import { File } from './file'
import { addLoader } from './loaders'

import type { Collections, Config } from './types'

interface BuildOptions {
  config?: string
  clean?: boolean
  watch?: boolean
  verbose?: boolean
}

class Builder {
  private readonly options: BuildOptions
  private readonly config: Config
  private readonly result: Collections

  constructor(options: BuildOptions) {
    this.options = options
    this.config = {} as Config
    this.result = {}
  }

  /**
   * init builder config
   */
  async init() {
    const { config: filename, clean, verbose } = this.options

    // resolve config
    const config = await resolveConfig({ filename, clean, verbose })

    // register user loaders
    config.loaders.forEach(addLoader)

    // init static output config
    initOutputConfig(config.output)

    // prerequisite
    // rm static dir not safe, so rm only the output file
    const outputStaticDir = dirname(join(config.output.static, config.output.filename))
    if (config.clean) {
      // clean output directories if `--clean` requested
      await rm(config.output.data, { recursive: true, force: true })
      await rm(outputStaticDir, { recursive: true, force: true })
      config.verbose && console.log('cleaned output directories')
    }
    await mkdir(config.output.data, { recursive: true })
    await mkdir(outputStaticDir, { recursive: true })

    // assign config
    Object.assign(this.config, config)
  }

  /**
   * generate entry from config.schemas
   * @returns entry content and dts
   */
  private async generateEntry() {
    const { configPath, output, schemas } = this.config
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
    const logs: string[] = []
    await Promise.all(
      Object.entries(this.result).map(async ([name, data]) => {
        if (data == null) return
        const json = JSON.stringify(data, null, 2)
        await writeFile(join(this.config.output.data, name + '.json'), json)
        logs.push(`${data.length ?? 1} ${name}`)
      })
    )
    const [enery, dts] = await this.generateEntry()
    await writeFile(join(this.config.output.data, 'index.js'), enery)
    await writeFile(join(this.config.output.data, 'index.d.ts'), dts)
    console.log(`output ${logs.join(', ')} and entry file`)
  }

  /**
   * build content with config
   * @param changed changed file path
   */
  async build(changed?: string) {
    const { root, verbose, schemas, onSuccess } = this.config

    verbose && console.log(`searching files in '${root}'`)

    cache.clear() // clear cache in case of rebuild

    const files: File[] = []

    const tasks = Object.entries(schemas).map(async ([name, schema]) => {
      if (changed != null && !micromatch.isMatch(changed, schema.pattern)) {
        // skip schema if changed file not match
        // TODO: rebuild only changed file ???
        const data = this.result[name]
        if (data != null) return [name, data] as const
      }

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

  /**
   * watch config file changes and reinit builder
   */
  private async watchConfig() {
    for await (const event of watch(this.config.configPath)) {
      const { filename } = event
      if (filename == null) continue
      console.log(`config changed: ${filename}`)
      await this.init().catch(console.error)
      await this.build().catch(console.error)
    }
  }

  /**
   * watch content files changes and rebuild
   */
  private async watchRoot() {
    const { schemas } = this.config
    const allPatterns = Object.values(schemas).map(schema => schema.pattern)

    const watcher = watch(this.config.root, { recursive: true })
    console.log(`watching for changes in '${this.config.root}'`)

    for await (const event of watcher) {
      const { filename } = event
      if (filename == null) continue
      if (!allPatterns.some(pattern => micromatch.isMatch(filename, pattern))) continue
      console.log(`file changed: ${filename}`)
      await this.build(filename).catch(console.error)
    }
  }

  /**
   * start watching
   */
  watch() {
    console.clear()
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
