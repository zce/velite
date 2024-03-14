import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'
import { loaders } from './loaders'
import { logger } from './logger'

import type { Config, UserConfig } from './types'

/**
 * recursive 3-level search files in cwd and its parent directories
 * @param files filenames (relative or absolute)
 * @param cwd start directory
 * @param depth search depth
 * @returns filename first searched
 */
const searchFiles = async (files: string[], cwd: string = process.cwd(), depth: number = 3): Promise<string | undefined> => {
  for (const file of files) {
    try {
      const path = resolve(cwd, file)
      await access(path) // check file exists
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return await searchFiles(files, dirname(cwd), depth - 1)
  }
}

/**
 * bundle and load user config file
 * @param path config file path
 * @returns user config module
 */
const loadConfig = async (path: string): Promise<UserConfig> => {
  // TODO: import js (mjs, cjs) config file directly without esbuild?
  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(path)) {
    const ext = path.split('.').pop()
    throw new Error(`not supported config file with '${ext}' extension`)
  }

  const outfile = join(path, '../node_modules/.velite.config.compiled.mjs')

  await build({
    entryPoints: [path],
    outfile,
    bundle: true,
    write: true,
    format: 'esm',
    target: 'node18',
    platform: 'node',
    plugins: [
      {
        name: 'make-all-packages-external',
        setup: build => {
          const filter = /^(?:@[a-z0-9_-]+\/)?[a-z0-9_-][a-z0-9._-]*$/i
          build.onResolve({ filter }, args => ({ path: args.path, external: true }))
        }
      }
    ]
  })

  const configUrl = pathToFileURL(outfile)
  configUrl.searchParams.set('t', Date.now().toString()) // prevent import cache

  const mod = await import(configUrl.href)
  return mod.default ?? mod
}

/**
 * resolve config from user's project
 * @param path specific config file path (relative or absolute)
 * @param clean whether to clean output directories, for cli option
 * @returns resolved config object with default values
 */
export const resolveConfig = async (path?: string, clean?: boolean): Promise<Config> => {
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
  if (configPath == null) throw new Error(`config file not found, create '${name}.config.ts' in your project root`)

  const { root, output, collections, loaders: customLoaders = [], ...rest } = await loadConfig(configPath)
  if (collections == null) throw new Error("'collections' is required in config file")

  logger.log(`using config '${configPath}'`, begin)

  const cwd = dirname(configPath)

  return {
    ...rest,
    configPath,
    collections,
    cache: new Map(),
    root: resolve(cwd, root ?? 'content'),
    output: {
      data: resolve(cwd, output?.data ?? '.velite'),
      assets: resolve(cwd, output?.assets ?? 'public/static'),
      base: output?.base ?? '/static/',
      name: output?.name ?? '[name]-[hash:8].[ext]',
      // ignore: output?.ignore ?? [],
      clean: clean ?? output?.clean ?? false
    },
    loaders: [...customLoaders, ...loaders]
  }
}
