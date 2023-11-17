import type { VFile } from 'vfile'
import type { ZodType } from 'zod'

/**
 * Collection data from file
 */
export type Collection = Record<string, any> | Record<string, any>[]

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
   * The output directory of the static files,
   * recommended to set it to a subdirectory under public for accessible
   * @default 'public'
   */
  static: string
  /**
   * The public base path of the static files
   * @default '/static/[name]-[hash:8].[ext]'
   */
  filename: string
  /**
   * The ext blacklist of the static files, such as ['md']
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
   *   raw: z.string() // from markdown,
   *   plain: z.string() // from markdown,
   *   excerpt: z.string() // from markdown,
   *   html: z.string() // from markdown
   * })
   */
  fields: ZodType
}

/**
 * Config
 */
export interface Config<Schemas extends Record<string, Schema> = Record<string, Schema>> {
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
   * Whether to print verbose log
   * @default false
   */
  verbose: boolean
  /**
   * The content schemas
   */
  schemas: Schemas
  /**
   * File loaders
   * @default [] (built-in loaders: 'json', 'yaml', 'markdown')
   */
  loaders: Loader[]
  // markdown: MarkdownOptions
  /**
   * Success callback, you can do anything you want with the collections, such as modify them, or write them to files
   */
  onSuccess?: (collections: {
    [name in keyof Schemas]: Schemas[name]['single'] extends true ? Schemas[name]['fields']['_output'] : Array<Schemas[name]['fields']['_output']>
  }) => void | Promise<void>
}

/**
 * User config
 */
export interface UserConfig<Schemas extends Record<string, Schema> = Record<string, Schema>> {
  /**
   * The root directory of the contents
   * @default 'content'
   */
  root?: string
  /**
   * Output configuration
   */
  output?: Partial<Output>
  /**
   * Whether to clean the output directories before build
   * @default false
   */
  clean?: boolean
  /**
   * Whether to print verbose log
   * @default false
   */
  verbose?: boolean
  /**
   * The content schemas
   */
  schemas: Schemas
  /**
   * File loaders
   * @default [] (built-in loaders: 'json', 'yaml', 'markdown')
   */
  loaders?: Loader[]
  // markdown?: MarkdownOptions
  /**
   * Success callback, you can do anything you want with the collections, such as modify them, or write them to files
   */
  onSuccess?: (collections: {
    [name in keyof Schemas]: Schemas[name]['single'] extends true ? Schemas[name]['fields']['_output'] : Array<Schemas[name]['fields']['_output']>
  }) => void | Promise<void>
}

// export for user config type inference
export const defineLoader = (loader: Loader) => loader
export const defineConfig = <Schemas extends Record<string, Schema>>(userConfig: UserConfig<Schemas>) => userConfig
