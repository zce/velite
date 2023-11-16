/**
 * @file Load config from user's project
 */

import { access, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'

import type { Config, UserConfig } from './types'

const isRootPath = (path: string): boolean => path === '/' || path.endsWith(':\\')

/**
 * recursively search files in parent directories
 * @param files filenames
 * @param cwd start directory
 * @param depth search depth
 * @returns filename searched
 */
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

/**
 * load config module by esbuild
 * @param filename config filename
 * @returns config module
 */
const loadConfig = async (filename: string): Promise<UserConfig> => {
  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(filename)) {
    const ext = filename.split('.').pop()
    throw new Error(`not supported config file with '${ext}' extension`)
  }

  // const { text, path } = result.outputFiles[0]
  // const mod = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`)
  // return mod.default ?? mod

  const outfile = join(filename, '..', '.velite.config.mjs')
  try {
    await build({
      entryPoints: [filename],
      bundle: true,
      write: true,
      format: 'esm',
      target: 'node18',
      platform: 'node',
      sourcemap: 'inline',
      external: ['velite'],
      outfile
    })
    const mod = await import(pathToFileURL(outfile).href)
    return mod.default ?? mod
  } catch (err: any) {
    throw new Error(`load config failed: ${err.message}`)
  } finally {
    await rm(outfile, { force: true })
  }
}

interface Options {
  filename?: string
  clean?: boolean
  watch?: boolean
  verbose?: boolean
}

/**
 * resolve config from user's project
 * @param options options from CLI
 * @returns config object with default values
 */
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

  const userConfig: UserConfig = await loadConfig(filename)

  if (userConfig.schemas == null) throw new Error(`'schemas' is required in config file`)

  const dir = dirname(filename)
  const verbose = options.verbose ?? userConfig.verbose ?? false

  verbose && console.log(`using config '${filename}'`)

  return {
    root: resolve(dir, userConfig.root ?? 'content'),
    output: {
      data: resolve(dir, userConfig.output?.data ?? '.velite'),
      static: resolve(dir, userConfig.output?.static ?? 'public'),
      filename: userConfig.output?.filename ?? '/static/[name]-[hash:8].[ext]',
      ignoreFileExtensions: userConfig.output?.ignoreFileExtensions ?? []
    },
    clean: options.clean ?? userConfig.clean ?? false,
    watch: options.watch ?? false,
    verbose,
    schemas: userConfig.schemas,
    loaders: userConfig.loaders ?? [],
    onSuccess: userConfig.onSuccess
  }
}
