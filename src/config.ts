import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'
import { logger } from './logger'

import type { Config, UserConfig } from './types'

let config: Config | null = null

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
    try {
      const path = join(cwd, file)
      await access(path)
      return path
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

  const outfile = join(filename, '../node_modules/.velite/config.compiled.mjs')

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

    const configUrl = pathToFileURL(outfile)
    configUrl.searchParams.set('t', Date.now().toString())

    const mod = await import(configUrl.href)
    return mod.default ?? mod
  } catch (err: any) {
    throw new Error(`load config failed: ${err.message}`)
  }
}

interface ConfigOptions {
  filename?: string
  clean?: boolean
}

/**
 * resolve config from user's project
 * @param options options from CLI
 * @returns config object with default values
 */
export const resolveConfig = async (options: ConfigOptions = {}): Promise<Config> => {
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

  const cwd = dirname(filename)

  config = {
    configPath: filename,
    root: join(cwd, userConfig.root ?? 'content'),
    output: {
      data: join(cwd, userConfig.output?.data ?? '.velite'),
      static: join(cwd, userConfig.output?.static ?? 'public'),
      filename: userConfig.output?.filename ?? '/static/[name]-[hash:8].[ext]',
      ignoreFileExtensions: userConfig.output?.ignoreFileExtensions ?? []
    },
    clean: options.clean ?? userConfig.clean ?? false,
    schemas: userConfig.schemas,
    loaders: userConfig.loaders ?? [],
    markdown: { gfm: true, removeComments: true, copyLinkedFiles: true, remarkPlugins: [], rehypePlugins: [], ...userConfig.markdown },
    mdx: { gfm: true, removeComments: true, copyLinkedFiles: true, remarkPlugins: [], rehypePlugins: [], ...userConfig.mdx },
    onSuccess: userConfig.onSuccess
  }

  logger.log(`using config '${filename}'`)

  return config
}

/**
 * get resolved config, must be called after `resolveConfig`
 * @returns config object
 */
export const getConfig = (): Config => {
  if (config == null) throw new Error(`config not resolved`)
  return config
}
