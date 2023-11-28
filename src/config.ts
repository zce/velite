import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'
import { logger } from './logger'

import type { Loader } from './loaders'
import type { LogLevel } from './logger'
import type { MarkdownOptions, MdxOptions } from './schemas'
import type { ZodType } from 'zod'

type Promisable<T> = T | Promise<T>

/**
 * Output options
 */
export interface Output {
  /**
   * The output directory of the data files (relative to config file).
   * @default '.velite'
   */
  data: string
  /**
   * The directory of the assets (relative to config file),
   * should be served statically by the app
   * `--clean` will automatically clear this directory
   * @default 'public/static'
   */
  assets: string
  /**
   * The public base path of the assets
   * @default '/static/'
   */
  base: '/' | `/${string}/` | `.${string}/` | `${string}:${string}/`
  /**
   * This option determines the name of each output asset.
   * The asset will be written to the directory specified in the `output.assets` option.
   * You can use `[name]`, `[hash]` and `[ext]` template strings with specify length.
   * @default '[name]-[hash:8].[ext]'
   */
  filename: string
  /**
   * The extensions blacklist of the assets, such as `['.md', '.yml']`
   * @default []
   */
  ignore: string[]
  /**
   * Whether to clean the output directories before build
   * @default false
   */
  clean: boolean
}

/**
 * Collection options
 */
export interface Collection {
  /**
   * Schema name (singular), for types generation
   * @example
   * 'Post'
   */
  name: string
  /**
   * Schema glob pattern, based on `root`
   * @example
   * 'posts/*.md'
   */
  pattern: string
  /**
   * Whether the schema is single
   * @default false
   */
  single?: boolean
  /**
   * Schema
   * @see {@link https://zod.dev}
   * @example
   * z.object({
   *   title: z.string(), // from frontmatter
   *   description: z.string().optional(), // from frontmatter
   *   excerpt: z.string() // from markdown body,
   *   content: z.string() // from markdown body
   * })
   */
  schema: ZodType
}

/**
 * All collections
 */
export interface Collections {
  [name: string]: Collection
}

/**
 * This interface for plugins extension user config
 * @example
 * declare module 'velite' {
 *   interface PluginConfig {
 *     myPlugin: MyPluginConfig
 *   }
 * }
 */
export interface PluginConfig {
  /**
   * File loaders
   */
  loaders: Loader[]
  /**
   * Markdown options
   */
  markdown: MarkdownOptions
  /**
   * Global MDX options
   */
  mdx: MdxOptions
}

/**
 * Config
 */
export interface Config<C extends Collections = Collections> extends Partial<PluginConfig> {
  /**
   * resolved config file path
   */
  configPath: string
  /**
   * The root directory of the contents
   * @default 'content'
   */
  root: string
  /**
   * Output configuration
   */
  output: Output
  /**
   * Collections
   */
  collections: C
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   */
  prepare?: (data: {
    [name in keyof C]: C[name]['single'] extends true ? C[name]['schema']['_output'] : Array<C[name]['schema']['_output']>
  }) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   */
  complete?: () => Promisable<void>
}

/**
 * User config
 */
export interface UserConfig<C extends Collections = Collections> extends Omit<Partial<Config<C>>, 'configPath' | 'output'> {
  /**
   * Output configuration
   */
  output?: Partial<Output>
}

let config: Config | null = null

/**
 * get resolved config, must be called after `resolveConfig`
 * @returns config object
 */
export const getConfig = (): Config => {
  if (config != null) return config
  throw new Error(`config not resolved, ensure 'resolveConfig' called before`)
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
      const path = resolve(cwd, file)
      await access(path)
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return searchFiles(files, resolve(cwd, '..'), depth - 1)
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

  const outfile = resolve(filename, '../node_modules/.velite/config.compiled.mjs')

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
    err.message = `load config failed: ${err.message}`
    throw err
  }
}

interface ConfigOptions {
  path?: string
  clean?: boolean
  logLevel?: LogLevel
}

/**
 * resolve config from user's project
 * @param options config options
 * @returns resolved config object with default values
 */
export const resolveConfig = async ({ path, clean, logLevel }: ConfigOptions = {}): Promise<Config> => {
  // set log level
  logLevel && logger.set(logLevel)

  // prettier-ignore
  const files = path != null ? [path]: [
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

  if (collections == null) throw new Error(`'collections' is required in config file`)

  const cwd = dirname(configPath)

  config = {
    ...rest,
    root: resolve(cwd, root ?? 'content'),
    output: {
      data: resolve(cwd, output?.data ?? '.velite'),
      assets: resolve(cwd, output?.assets ?? 'public/static'),
      base: output?.base ?? '/static/',
      filename: output?.filename ?? '[name]-[hash:8].[ext]',
      ignore: output?.ignore ?? [],
      clean: clean ?? output?.clean ?? false
    },
    collections,
    configPath
  }

  logger.log(`using config '${configPath}'`)

  return config
}

/**
 * Define a collection (identity function for type inference)
 */
export const defineCollection = (collection: Collection) => collection

/**
 * Define config (identity function for type inference)
 */
export const defineConfig = <C extends Collections>(config: UserConfig<C>) => config
