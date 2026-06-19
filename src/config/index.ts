import type { Collections, Result } from '../collections'
import type { Loader } from '../loaders/types'
import type { Output } from '../output'
import type { MarkdownOptions } from '../schemas/markdown'
import type { MdxOptions } from '../schemas/mdx'

type Promisable<T> = T | Promise<T>

/**
 * Hook context
 */
export type HookContext = {
  /**
   * Resolved config
   */
  config: Config
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
   * If true, throws error and terminates process if any schema validation fails.
   *
   * @default false
   */
  strict?: boolean
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
  prepare?: (data: Result<T>, context: HookContext) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param data loaded data
   */
  complete?: (data: Result<T>, context: HookContext) => Promisable<void>
}

/**
 * Build Config
 */
export interface Config extends Readonly<UserConfig> {
  /**
   * Resolved config file path
   */
  readonly configPath: string
  /**
   * Dependencies of the config file
   */
  readonly configImports: string[]
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

/**
 * Define config (identity function for type inference)
 */
export const defineConfig = <T extends Collections>(config: UserConfig<T>): UserConfig<T> => config
