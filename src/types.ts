import type { CompileOptions } from '@mdx-js/mdx'
import type { PluggableList } from 'unified'
import type { Data, VFile } from 'vfile'
import type { Schema } from './schemas'

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
    /**
     * content plain text
     */
    plain: string
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
  name: string
  // /**
  //  * The extensions blacklist of the assets, such as `['.md', '.yml']`
  //  * @default []
  //  */
  // ignore: string[]
  /**
   * Whether to clean the output directories before build
   * @default false
   */
  clean: boolean
}

/**
 * Collection options
 */
export interface Collection<T extends Schema> {
  /**
   * Collection name (singular), for types generation
   * @example
   * 'Post'
   */
  name: string
  /**
   * Collection glob pattern, based on `root`
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
   * Collection schema
   * @see {@link https://zod.dev}
   * @example
   * s.object({
   *   title: s.string(), // from frontmatter
   *   description: s.string().optional(), // from frontmatter
   *   excerpt: s.string() // from markdown body,
   *   content: s.string() // from markdown body
   * })
   */
  schema: T
}

/**
 * All collections
 */
export interface Collections {
  [name: string]: Collection<Schema>
}

/**
 * Collection Type
 */
export type CollectionType<T extends Collections, P extends keyof T> = T[P]['single'] extends true ? T[P]['schema']['_output'] : Array<T[P]['schema']['_output']>

/**
 * All collections result
 */
export type Result<T extends Collections> = { [P in keyof T]: CollectionType<T, P> }

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
   * Custom file loaders, will be merged with built-in loaders (matter, yaml, json)
   * @default []
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
   * Global cache (need refresh in rebuild)
   * memory level cache is enough for Velite. and it's easy & efficient.
   * maybe we can use other cache way in the future if needed.
   * but for now, we just need a simple cache.
   */
  readonly cache: Map<string, any>
  /**
   * Resolved config file path
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
  /**
   * File loaders
   */
  readonly loaders: Loader[]
}

// ↓↓↓ helper identity functions for type inference

/**
 * Define a collection (identity function for type inference)
 */
export const defineCollection = <T extends Schema>(collection: Collection<T>) => collection

/**
 * Define a loader (identity function for type inference)
 */
export const defineLoader = (loader: Loader) => loader

/**
 * Define config (identity function for type inference)
 */
export const defineConfig = <T extends Collections>(config: UserConfig<T>) => config

// ↑↑↑ helper identity functions for type inference
