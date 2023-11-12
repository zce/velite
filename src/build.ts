import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import glob from 'fast-glob'
import { reporter } from 'vfile-reporter'

import { resolveConfig } from './config'
import { File } from './file'

type Options = {
  root?: string
  config?: string
  clean?: boolean
  verbose?: boolean
}

export const build = async (options: Options) => {
  const config = await resolveConfig({ root: options.root, filename: options.config, verbose: options.verbose })

  // prerequisite
  if (options.clean) {
    // clean output directories if `--clean` requested
    await rm(config.output.data, { recursive: true, force: true })
    await rm(config.output.static, { recursive: true, force: true })
    options.verbose && console.log('cleaned output directories')
  }

  // ensure output directories exist
  await mkdir(config.output.data, { recursive: true })
  await mkdir(config.output.static, { recursive: true })
  options.verbose && console.log('ensured output directories')

  const tasks = Object.entries(config.schemas).map(async ([name, schema]) => {
    const filenames = await glob(schema.pattern, { cwd: config.root, onlyFiles: true, ignore: ['**/_*'] })
    options.verbose && console.debug(`found ${filenames.length} files matching '${schema.pattern}'`)

    const files = await Promise.all(
      filenames.map(async file => {
        const doc = await File.create(join(config.root, file))
        await doc.parse(schema.fields)
        return doc
      })
    )

    const report = reporter(files, { quiet: true })
    report && console.log(report)

    const data = files
      .map(f => f.data.result ?? [])
      .flat()
      .filter(Boolean)

    return [name, data] as const
  })

  const collections = await Promise.all(tasks)

  // user callback
  config.callback != null && (await config.callback(Object.fromEntries(collections)))

  // output data to dist
  await Promise.all(
    collections.map(async ([name, data]) => {
      const output = JSON.stringify(data, null, 2)
      await writeFile(join(config.output.data, name + '.json'), output)
      console.log(`wrote ${data.length} ${name} to '${join(config.output.data, name + '.json')}'`)
    })
  )
}
