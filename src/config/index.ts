import type { BuildResult, Collections } from '../collections'
import type { VeliteLoader } from '../loaders/types'
import type { VeliteOutput } from '../output'
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
  config: ResolvedConfig
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
  output?: Partial<VeliteOutput>
  /**
   * All collections
   */
  collections: T
  /**
   * Custom file loaders, will be merged with built-in loaders (matter, yaml, json)
   * @default []
   */
  loaders?: VeliteLoader[]
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
  prepare?: (data: BuildResult<T>, context: HookContext) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   * @param data loaded data
   */
  complete?: (data: BuildResult<T>, context: HookContext) => Promisable<void>
}

/**
 * Fully resolved build config.
 */
export interface ResolvedConfig extends Readonly<UserConfig> {
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
  readonly output: VeliteOutput
  /**
   * File loaders
   */
  readonly loaders: VeliteLoader[]
}

/**
 * Define config (identity function for type inference)
 */
export const defineConfig = <T extends Collections>(config: UserConfig<T>): UserConfig<T> => config
