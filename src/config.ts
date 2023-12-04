import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'
import { logger } from './logger'

import type { Config, ResolvedConfig } from './types'

let resolvedConfig: ResolvedConfig | null = null

/**
 * get resolved config, must be called after `resolveConfig`
 * @returns resolved config
 */
export const getConfig = (): ResolvedConfig => {
  if (resolvedConfig != null) return resolvedConfig
  throw new Error("config not resolved, ensure 'resolveConfig' called before")
}

/**
 * recursive 3-level search files in cwd and its parent directories
 * @param files filenames
 * @param cwd start directory
 * @param depth search depth
 * @returns filename first searched
 */
const searchFiles = async (files: string[], cwd: string = process.cwd(), depth: number = 3): Promise<string | undefined> => {
  for (const file of files) {
    try {
      const path = join(cwd, file)
      await access(path) // check file exists
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return await searchFiles(files, join(cwd, '..'), depth - 1)
  }
}

/**
 * bundle and load user config file
 * @param filename config filename
 * @returns user config module
 */
const loadConfig = async (filename: string): Promise<Config> => {
  // TODO: import js (mjs, cjs) config file directly without esbuild

  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(filename)) {
    const ext = filename.split('.').pop()
    throw new Error(`not supported config file with '${ext}' extension`)
  }

  const outfile = join(filename, '../node_modules/.velite/config.compiled.mjs')

  await build({
    entryPoints: [filename],
    bundle: true,
    write: true,
    format: 'esm',
    target: 'node18',
    platform: 'node',
    external: ['velite'],
    outfile
  })

  const configUrl = pathToFileURL(outfile)
  configUrl.searchParams.set('t', Date.now().toString()) // prevent import cache

  const mod = await import(configUrl.href)
  return mod.default ?? mod
}

/**
 * resolve config from user's project
 * @param path specific config file path
 * @param clean whether to clean output directories, for cli option
 * @returns resolved config object with default values
 */
export const resolveConfig = async (path?: string, clean?: boolean): Promise<ResolvedConfig> => {
  const begin = performance.now()

  // prettier-ignore
  const files = path != null ? [path] : [
    name + '.config.js',
    name + '.config.ts',
    name + '.config.mjs',
    name + '.config.mts',
    name + '.config.cjs',
    name + '.config.cts'
  ]

  const configPath = await searchFiles(files)
  if (configPath == null) throw new Error(`config file not found, create '${name}.config.ts' in your project root directory`)

  const { root, output, collections, ...rest } = await loadConfig(configPath)
  if (collections == null) throw new Error("'collections' is required in config file")

  logger.log(`using config '${configPath}'`, begin)

  const cwd = dirname(configPath)

  resolvedConfig = {
    ...rest,
    configPath,
    collections,
    root: resolve(cwd, root ?? 'content'),
    output: {
      data: resolve(cwd, output?.data ?? '.velite'),
      assets: resolve(cwd, output?.assets ?? 'public/static'),
      base: output?.base ?? '/static/',
      filename: output?.filename ?? '[name]-[hash:8].[ext]',
      ignore: output?.ignore ?? [],
      clean: clean ?? output?.clean ?? false
    }
  }

  return resolvedConfig
}
