import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

import { name } from '../package.json'
import { logger } from './logger'

import type { CompileOptions } from '@mdx-js/mdx'
import type { PluggableList } from 'unified'
import type { Data, VFile } from 'vfile'
import type { ZodSchema } from 'zod'

type Promisable<T> = T | Promise<T>

/**
 * Markdown options
 */
export interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}

/**
 * MDX compiler options
 */
export interface MdxOptions extends Omit<CompileOptions, 'outputFormat'> {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Output format to generate.
   * @default 'function-body'
   */
  outputFormat?: CompileOptions['outputFormat']
}

declare module 'vfile' {
  interface DataMap {
    /**
     * original data loaded from file
     */
    data: unknown
    /**
     * content without frontmatter
     */
    content: string
  }
}

/**
 * File data loader
 */
export interface Loader {
  /**
   * File test regexp
   * @example /\.md$/
   */
  test: RegExp
  /**
   * Load file data from file.value
   * @param file vfile
   */
  load: (file: VFile) => Promisable<Data>
}

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
   * @example
   * '/' -> '/image.png'
   * '/static/' -> '/static/image.png'
   * './static/' -> './static/image.png'
   * 'https://cdn.example.com/' -> 'https://cdn.example.com/image.png'
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
  schema: ZodSchema
}

/**
 * All collections
 */
export interface Collections {
  [name: string]: Collection
}

/**
 * All collections result
 */
export type Result<T extends Collections> = {
  [K in keyof T]: T[K]['single'] extends true ? T[K]['schema']['_output'] : Array<T[K]['schema']['_output']>
}

/**
 * This interface for plugins extra user config
 * @example
 * declare module 'velite' {
 *   interface PluginConfig {
 *     myPlugin: MyPluginConfig
 *   }
 * }
 */
export interface PluginConfig {}

/**
 * Velite user configuration
 */
export interface UserConfig<T extends Collections = Collections> extends Partial<PluginConfig> {
  /**
   * The root directory of the contents (relative to config file).
   * @default 'content'
   */
  root?: string
  /**
   * Output configuration
   */
  output?: Partial<Output>
  /**
   * All collections
   */
  collections: T
  /**
   * File loaders
   */
  loaders?: Loader[]
  /**
   * Global Markdown options
   */
  markdown?: MarkdownOptions
  /**
   * Global MDX options
   */
  mdx?: MdxOptions
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   * @param data loaded data
   */
  prepare?: (data: Result<T>) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param data loaded data
   */
  complete?: (data: Result<T>) => Promisable<void>
}

/**
 * Build Config
 */
export interface Config extends Readonly<UserConfig> {
  /**
   * context file path
   */
  readonly configPath: string
  /**
   * The root directory of the contents (relative to config file).
   */
  readonly root: string
  /**
   * Output configuration
   */
  readonly output: Output
}

let resolvedConfig: Config | null = null

/**
 * get resolved config, must be called after `resolveConfig`
 * @returns resolved config
 */
export const getConfig = (): Config => {
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
      const path = resolve(cwd, file)
      await access(path) // check file exists
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return await searchFiles(files, resolve(cwd, '..'), depth - 1)
  }
}

/**
 * bundle and load user config file
 * @param filename config filename
 * @returns user config module
 */
const loadConfig = async (filename: string): Promise<UserConfig> => {
  // TODO: import js (mjs, cjs) config file directly without esbuild?
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

// ↓↓↓ helper identity functions for type inference

/**
 * Define a collection (identity function for type inference)
 */
export const defineCollection = (collection: Collection) => collection

/**
 * Define a loader (identity function for type inference)
 */
export const defineLoader = (loader: Loader) => loader

/**
 * Define config (identity function for type inference)
 */
export const defineConfig = <C extends Collections>(config: UserConfig<C>) => config
