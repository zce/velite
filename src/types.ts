import type { CompileOptions } from '@mdx-js/mdx'
import type { PluggableList } from 'unified'
import type { VFile } from 'vfile'
import type { ZodType } from 'zod'

type Promisable<T> = T | Promise<T>

/**
 * Image object with metadata & blur image
 */
export interface Image {
  /**
   * public url of the image
   */
  src: string
  /**
   * image width
   */
  width: number
  /**
   * image height
   */
  height: number
  /**
   * blurDataURL of the image
   */
  blurDataURL: string
  /**
   * blur image width
   */
  blurWidth: number
  /**
   * blur image height
   */
  blurHeight: number
}

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
  outputFormat: CompileOptions['outputFormat']
}

/**
 * File loader
 */
export interface Loader {
  /**
   * File test regexp
   * @example /\.md$/
   */
  test: RegExp
  /**
   * Load file data to `file.data`
   * @param file vfile
   */
  load: (file: VFile) => Promisable<void>
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
 * Result
 */
type Result<T extends Collections> = {
  [N in keyof T]: T[N]['single'] extends true ? T[N]['schema']['_output'] : Array<T[N]['schema']['_output']>
}

/**
 * Config
 */
export interface Config<T extends Collections = Collections> extends Partial<PluginConfig> {
  /**
   * resolved config file path
   */
  configPath: string
  /**
   * The root directory of the contents (relative to config file).
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
  collections: T
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   * @param result loaded data
   */
  prepare?: (result: Result<T>) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param result loaded data
   */
  complete?: (result: Result<T>) => Promisable<void>
}

/**
 * User config
 */
export interface UserConfig<T extends Collections = Collections> extends Omit<Partial<Config<T>>, 'configPath' | 'output'> {
  /**
   * Output configuration
   */
  output?: Partial<Output>
}

// ↓↓↓ identity functions for type inference

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
