import type { Collections } from '../collections'
import type { OutputConfig, PrepareHook } from '../config'
import type { Loader } from '../loaders/types'
import type { MarkdownOptions } from '../schemas/markdown'
import type { MdxOptions } from '../schemas/mdx'

/**
 * A resolved, immutable project snapshot.
 *
 * `Project` is the fully-resolved view of a user config: absolute paths,
 * merged loaders, resolved output and effective strictness. A config change
 * produces a brand-new `Project`; the old one is never mutated in place.
 */
export interface Project<T extends Collections = Collections> {
  readonly root: string
  readonly configPath: string
  readonly configImports: readonly string[]
  readonly collections: T
  readonly loaders: readonly Loader[]
  readonly output: ResolvedOutput
  readonly strict: boolean
  readonly markdown?: MarkdownOptions
  readonly mdx?: MdxOptions
  readonly prepare?: PrepareHook<T>
}

/**
 * Resolved output configuration.
 *
 * Combines the public `OutputConfig` (the locked user-facing shape) with the
 * internal asset filename template. The template is an internal physical-output
 * concern and is intentionally not part of the public `OutputConfig`.
 */
export interface ResolvedOutput extends OutputConfig {
  /** Asset filename template, e.g. `[name]-[hash:8].[ext]`. */
  readonly name: string
}
