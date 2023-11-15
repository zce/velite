/**
 * @file Load config from user's project
 */

import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'esbuild'

import { name } from '../package.json'
import { addLoader } from './loaders'

import type { Config } from './types'

const isRootPath = (path: string): boolean => path === '/' || path.endsWith(':\\')

const search = async (files: string[], cwd: string = process.cwd(), depth: number = 3): Promise<string | undefined> => {
  for (const file of files) {
    const filepath = join(cwd, file)
    try {
      await access(filepath)
      return filepath
    } catch {
      continue
    }
  }
  if (depth > 0 && !isRootPath(cwd)) {
    return await search(files, join(cwd, '..'), depth - 1)
  }
}

const loadConfig = async (filename: string): Promise<any> => {
  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(filename)) {
    const ext = filename.split('.').pop()
    throw new Error(`not supported config file with '${ext}' extension`)
  }
  const result = await build({
    entryPoints: [filename],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'node18',
    platform: 'node',
    sourcemap: 'inline'
  })
  const { text } = result.outputFiles[0]
  const mod = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
  return mod.default ?? mod
}

type Options = {
  root?: string
  filename?: string
  verbose?: boolean
}

export const resolveConfig = async (options: Options = {}): Promise<Config> => {
  // prettier-ignore
  const files = [
    name + '.config.js',
    name + '.config.mjs',
    name + '.config.cjs',
    name + '.config.ts',
    name + '.config.mts',
    name + '.config.cts'
  ]

  options.filename != null && files.unshift(options.filename)

  const filename = await search(files)
  if (filename == null) throw new Error(`config file not found`)

  options.verbose && console.log(`using config '${filename}'`)

  const config: Config = await loadConfig(filename)

  config.loaders != null && config.loaders.forEach(addLoader)

  return config
}

resolveConfig().then(console.log).catch(console.error)
