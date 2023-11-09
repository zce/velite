import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { glob } from 'fast-glob'
import { VFile } from 'vfile'
import { resolveConfig } from './config'
import { Schema } from './types'
import { log } from './utils'

interface BuildOptions {
  config?: string
  clear?: boolean
  verbose?: boolean
}

export default async (options: BuildOptions = {}): Promise<void> => {
  // resolve user config
  const config = await resolveConfig(options.config)

  /**
   * Prepare output directories
   */
  const prepare = async () => {
    if (options.clear) {
      // clean output directories if `--clean` requested
      await rm(config.output.data, { recursive: true, force: true })
      await rm(config.output.public, { recursive: true, force: true })
      options.verbose && log('cleaned output directories')
    }

    // ensure output directories exist
    await mkdir(config.output.data, { recursive: true })
    await mkdir(config.output.public, { recursive: true })
    options.verbose && log('ensured output directories')
  }

  /**
   * Load schema
   */
  const loadFiles = async (schema: Schema): Promise<VFile[]> => {
    const filenames = await glob(schema.pattern, { cwd: config.root, onlyFiles: true, ignore: ['**/_*'] })
    return await Promise.all(
      filenames.map(async filename => {
        const contents = await readFile(join(config.root, filename), 'utf8')
        return new VFile({ path: filename, value: contents, data: { _schema: schema } })
      })
    )
  }

  // prepare output directories
  await prepare()

  await Promise.all(
    Object.entries(config.schemas).map(async ([name, schema]): Promise<[string, any[]]> => {
      const files = await loadFiles(schema)
      log(`loaded ${name} ${files.length} files`)

      return [name, files]
    })
  )
}
