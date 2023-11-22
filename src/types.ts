import { CompileOptions } from '@mdx-js/mdx'

import type { PluggableList } from 'unified'
import type { VFile } from 'vfile'
import type { ZodType } from 'zod'

type Promisable<T> = T | PromiseLike<T>

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
 * Entry from file
 */
export type Entry = Record<string, any>

/**
 * Data from file
 * @description
 * There may be one or more entries in a document file
 */
export type Data = Entry | Entry[]

/**
 * File loader
 */
export interface Loader {
  /**
   * Loader name
   * @description
   * The same name will overwrite the built-in loader,
   * built-in loaders: 'json', 'yaml', 'markdown'
   */
  name: string
  /**
   * File test regexp
   * @example
   * /\.md$/
   */
  test: RegExp
  /**
   * Load file content
   * @param vfile vfile
   */
  load: (vfile: VFile) => Data | Promise<Data>
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

/**
 * Config
 */
export interface Config<C extends Collections = Collections> {
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
  output: {
    /**
     * The output directory of the data
     * @default '.velite'
     */
    data: string
    /**
     * The output directory of the static assets,
     * should be served statically by the app
     * @default 'public'
     */
    static: string
    /**
     * The public base path of the static files.
     * Must include one level of directory, otherwise `--clean` will automatically clear the static root dir,
     * this means that other files in the static dir will also be cleared together
     * @default '/static/[name]-[hash:8].[ext]'
     */
    filename: `/${string}/${string}`
    /**
     * The ext blacklist of the static files, such as ['md', 'yml']
     * @default []
     */
    ignoreFileExtensions: string[]
    /**
     * Whether to clean the output directories before build
     * @default false
     */
    clean: boolean
  }
  /**
   * Collections
   */
  collections: C
  /**
   * File loaders
   * @default [] (built-in loaders: 'json', 'yaml', 'markdown')
   */
  loaders: Loader[]
  /**
   * Global markdown options
   */
  markdown: MarkdownOptions
  /**
   * Global MDX options
   */
  mdx: MdxOptions
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
  output?: Partial<Config['output']>
}

// ↓↓↓ export for user config type inference

/**
 * Define a loader
 */
export const defineLoader = (loader: Loader) => loader

/**
 * Define a collection
 */
export const defineCollection = (collection: Collection) => collection

/**
 * Define config
 */
export const defineConfig = <C extends Collections>(userConfig: UserConfig<C>) => userConfig
