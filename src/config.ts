import { createHash } from 'node:crypto'
import { access, mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

const prepareConfigOutdir = async (path: string): Promise<string> => {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  const outdir = join(tmpdir(), 'velite', `config-${hash}`)
  await mkdir(outdir, { recursive: true })

  const modules = await searchFiles(['node_modules'], dirname(path))
  if (modules != null) {
    const link = join(outdir, 'node_modules')
    try {
      await symlink(modules, link, 'dir')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
      let current: string | undefined
      try {
        current = await readlink(link)
      } catch {
        current = undefined
      }
      if (current !== modules) {
        await rm(link, { recursive: true, force: true })
        await symlink(modules, link, 'dir')
      }
    }
  }

  return outdir
}

/**
 * bundle and load user config file
 * @param path config file path
 * @returns user config object and dependencies
 */
const loadConfig = async (path: string): Promise<[UserConfig, string[]]> => {
  // TODO: import js (mjs, cjs) config file directly without esbuild?
  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(path)) {
    const ext = path.split('.').pop()
    throw new Error(`not supported config file with '${ext}' extension`)
  }

  const outfile = join(await prepareConfigOutdir(path), 'config.mjs')

  const result = await build({
    entryPoints: [path],
    outfile,
    bundle: true,
    write: true,
    format: 'esm',
    target: 'node18',
    platform: 'node',
    metafile: true,
    plugins: [
      {
        name: 'velite-self-reference',
        setup(build) {
          build.onResolve({ filter: new RegExp(`^${name}$`) }, () => ({
            path: fileURLToPath(import.meta.resolve(name)),
            external: true
          }))
        }
      }
    ],
    packages: 'external'
  })

  const deps = Object.keys(result.metafile.inputs).map(file => resolve(file))

  const configUrl = pathToFileURL(outfile)
  configUrl.searchParams.set('t', Date.now().toString()) // prevent import cache

  const mod = await import(configUrl.href)
  return [mod.default ?? mod, deps]
}

/**
 * resolve config from user's project
 * @param path specific config file path (relative or absolute)
 * @param options.strict if true, throws error and terminates process if any schema validation fails
 * @param options.clean if true, clean output directories before build
 * @returns resolved config object with default values
 */
export const resolveConfig = async (path?: string, options: { strict?: boolean; clean?: boolean } = {}): Promise<Config> => {
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

  const [loadedConfig, configImports] = await loadConfig(configPath)

  if (loadedConfig.collections == null) throw new Error(`'collections' is required in '${configPath}'`)

  logger.log(`using config '${configPath}'`, begin)

  const cwd = dirname(configPath)

  return {
    ...loadedConfig,
    configPath,
    configImports,
    root: resolve(cwd, loadedConfig.root ?? 'content'),
    output: {
      data: resolve(cwd, loadedConfig.output?.data ?? '.velite'),
      assets: resolve(cwd, loadedConfig.output?.assets ?? 'public/static'),
      base: loadedConfig.output?.base ?? '/static/',
      name: loadedConfig.output?.name ?? '[name]-[hash:8].[ext]',
      clean: options.clean ?? loadedConfig.output?.clean ?? false,
      format: loadedConfig.output?.format ?? 'esm'
    },
    loaders: [...(loadedConfig.loaders ?? []), ...loaders],
    strict: options.strict ?? loadedConfig.strict ?? false
  }
}
