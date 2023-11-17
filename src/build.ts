import { mkdir, rm, watch, writeFile } from 'node:fs/promises'
import { join, normalize, relative } from 'node:path'
import glob from 'fast-glob'
import micromatch from 'micromatch'
import { reporter } from 'vfile-reporter'

import { resolveConfig } from './config'
import { cache, initOutputConfig } from './context'
import { File } from './file'
import { addLoader } from './loaders'

import type { Config } from './types'

interface BuildOptions {
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
  static async create(options: BuildOptions) {
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
    await mkdir(config.output.data, { recursive: true })
    await mkdir(config.output.static, { recursive: true })

    return new Builder(config)
  }

  private async generateTsEntry() {
    const { configPath, output, schemas } = this.config
    const configRelPath = relative(output.data, normalize(configPath)).replace(/\\/g, '/').slice(0, -3)
    // prettier-ignore
    const code: string[] = [
      `import config from '${configRelPath}'`,
      `import type { TypeOf } from 'velite'`,
      `const schemas = config.schemas!`
    ]
    Object.entries(schemas).map(([name, schema]) => {
      const type = schema.name + (schema.single ? '' : '[]')
      code.push(`export type ${schema.name} = TypeOf<typeof schemas.${name}.fields>`)
      code.push(`export const ${name} = async (): Promise<${type}> => (await import('./${name}.json').then(m => m.default)) as ${type}`)
    })
    return code.join('\n\n')
  }

  /**
   * output result to dist
   */
  private async output() {
    await Promise.all(
      Object.entries(this.result).map(async ([name, data]) => {
        if (data == null) return
        const json = JSON.stringify(data, null, 2)
        await writeFile(join(this.config.output.data, name + '.json'), json)
        console.log(`wrote ${data.length ?? 1} ${name} to '${join(this.config.output.data, name + '.json')}'`)
      })
    )
    // TODO: generate ts entry ???
    // const code = await this.generateTsEntry()
    // await writeFile(join(this.config.output.data, 'index.ts'), code)
  }

  /**
   * build content with config
   * @param changed changed file path
   */
  async build(changed?: string) {
    if (this.config == null) throw new Error('config not initialized')
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
   * watch for changes
   */
  async watch() {
    const { schemas } = this.config
    const allPatterns = Object.values(schemas).map(schema => schema.pattern)

    const watcher = watch(this.config.root, { recursive: true })

    console.log(`watching for changes in '${this.config.root}'`)

    for await (const event of watcher) {
      const { filename } = event
      if (filename == null) continue
      if (!allPatterns.some(pattern => micromatch.isMatch(filename, pattern))) continue
      console.log(`file changed: ${filename}`)
      await this.build(filename)
    }
  }
}

export const build = async (options: BuildOptions) => {
  const builder = await Builder.create(options)
  await builder.build()
  if (!options.watch) return
  await builder.watch()
}
