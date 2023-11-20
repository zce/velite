import type { PluggableList } from 'unified'
import type { VFile } from 'vfile'
import type { ZodType } from 'zod'

/**
 * Collection data from file
 */
export type Collection = Record<string, any> | Record<string, any>[]

/**
 * All collection data from file
 */
export type Collections = Record<string, Collection>

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
  load: (vfile: VFile) => Collection | Promise<Collection>
}

export interface Output {
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
}

/**
 * Schema
 */
export interface Schema {
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
   * Schema fields
   * @see {@link https://zod.dev}
   * @example
   * z.object({
   *   title: z.string(), // from frontmatter
   *   description: z.string().optional(), // from frontmatter
   *   plain: z.string() // from markdown body,
   *   excerpt: z.string() // from markdown body,
   *   html: z.string() // from markdown body
   * })
   */
  fields: ZodType
}

/**
 * Schemas
 */
export interface Schemas {
  [name: string]: Schema
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
 * Mdx options
 */
export interface MdxOptions extends MarkdownOptions {}

/**
 * Config
 */
export interface Config<S extends Schemas = Schemas> {
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
   * Whether to clean the output directories before build
   * @default false
   */
  clean: boolean
  /**
   * The content schemas
   */
  schemas: S
  /**
   * File loaders
   * @default [] (built-in loaders: 'json', 'yaml', 'markdown')
   */
  loaders: Loader[]
  /**
   * Markdown options
   */
  markdown: Required<MarkdownOptions>
  /**
   * Mdx options
   */
  mdx: Required<MdxOptions>
  /**
   * Success callback, you can do anything you want with the collections, such as modify them, or write them to files
   */
  onSuccess?: (collections: {
    [name in keyof S]: S[name]['single'] extends true ? S[name]['fields']['_output'] : Array<S[name]['fields']['_output']>
  }) => void | Promise<void>
}

/**
 * User config
 */
export interface UserConfig<S extends Schemas = Schemas> extends Omit<Partial<Config<S>>, 'configPath' | 'output'> {
  /**
   * Output configuration
   */
  output?: Partial<Output>
}

// export for user config type inference
export const defineLoader = (loader: Loader) => loader
export const defineConfig = <S extends Schemas>(userConfig: UserConfig<S>) => userConfig
