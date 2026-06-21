import { resolveConfigPath } from './discover'
import { loadConfig } from './load'

import type { BuildResult, Collections } from '../collections'
import type { Diagnostic } from '../core/errors'
import type { Loader, Promisable } from '../loaders/types'
import type { OutputConfig } from '../output'
import type { MarkdownOptions } from '../schemas/markdown'
import type { MdxOptions } from '../schemas/mdx'
import type { LoadedConfig } from './load'

export type { OutputConfig } from '../output'
export type { LoadedConfig } from './load'

/** Result of the `prepare` hook: continue, skip output, or replace the result. */
export type PrepareResult<TCollections extends Collections> = void | false | BuildResult<TCollections>

/**
 * The output-oriented `prepare` hook.
 *
 * Receives the complete logical build result and may mutate it in place
 * (returning `void`), replace it (returning a new `BuildResult`), or skip
 * default output (returning `false`). Partial patch returns are not supported.
 */
export type PrepareHook<TCollections extends Collections = Collections> = (
  result: BuildResult<TCollections>,
  context: PrepareContext<TCollections>
) => Promisable<PrepareResult<TCollections>>

/** Context passed to the `prepare` hook. */
export interface PrepareContext<TCollections extends Collections = Collections> {
  readonly project: {
    readonly root: string
    readonly configPath: string
    readonly collections: TCollections
  }
  readonly diagnostics: readonly Diagnostic[]
}

/** Velite user configuration. */
export interface UserConfig<TCollections extends Collections = Collections> {
  /** Content root directory (relative to the config file). @default 'content' */
  root?: string
  /** Throw on any schema validation failure. @default false */
  strict?: boolean
  /** Output configuration. */
  output?: Partial<OutputConfig>
  /** All collections, keyed by their data export name. */
  collections: TCollections
  /** Custom loaders, merged with the built-in loaders. @default [] */
  loaders?: Loader[]
  /** Global Markdown options. */
  markdown?: MarkdownOptions
  /** Global MDX options. */
  mdx?: MdxOptions
  /** Output-oriented result-processing hook. */
  prepare?: PrepareHook<TCollections>
}

/**
 * Config loading abstraction.
 *
 * Implementations resolve a user-supplied (or discovered) config path into a
 * `LoadedConfig`. The default implementation uses jiti; tests can inject a mock.
 */
export interface ConfigLoader {
  resolvePath(path: string | undefined, cwd?: string): Promise<string>
  load(configPath: string): Promise<LoadedConfig<UserConfig>>
}

/** Define a config (identity helper for type inference). */
export const defineConfig = <TCollections extends Collections>(config: UserConfig<TCollections>): UserConfig<TCollections> => config

/** Default config loader: jiti-based loading with auto-discovery. */
export const defaultConfigLoader: ConfigLoader = {
  resolvePath: (path, cwd) => resolveConfigPath(path, cwd),
  load: configPath => loadConfig<UserConfig>(configPath)
}
