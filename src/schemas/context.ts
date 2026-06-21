import { AsyncLocalStorage } from 'node:async_hooks'

import type { Project } from '../core/project'
import type { SessionStore } from '../core/session'
import type { AssetProcessingCache } from '../assets/cache'
import type { AssetStore } from '../assets/store'
import type { Effect } from './effects'
import type { Collections } from '../collections'
import type { MarkdownOptions } from './markdown'
import type { MdxOptions } from './mdx'
import type { Nodes } from 'hast'
import type { Root } from 'mdast'

/**
 * A content file during schema parsing.
 *
 * AST fields (`mdast`, `hast`) are lazily computed on first access from
 * `content` and cached. They are not part of the stable 1.0 type contract
 * but are accessible at runtime for advanced use cases.
 */
export interface ContentFile {
  /** Stable source id (project-relative, POSIX). */
  readonly id: string
  /** Absolute source file path. */
  readonly path: string
  /** Raw text content (e.g. Markdown/MDX body), when available. */
  readonly content?: string
  /** Plain text extracted from content, when available. */
  readonly plain?: string
  /** Lazily-parsed Markdown AST, when content is available. */
  readonly mdast?: Root
  /** Lazily-parsed HTML AST, when content is available. */
  readonly hast?: Nodes
}

/** Identity of the record currently being parsed within a multi-record source. */
export interface ContentRecord {
  /** Stable record id (`sourceId#key`). */
  readonly id: string
  /** Loader-provided record key, when available. */
  readonly key?: string
  /** Record index within its source. */
  readonly index: number
}

/** Stable, public view of the resolved project. */
export interface ProjectInfo<T extends Collections = Collections> {
  readonly root: string
  readonly configPath: string
  readonly collections: T
  readonly output: { readonly data: string; readonly assets: string; readonly base: string; readonly name: string }
  readonly markdown?: MarkdownOptions
  readonly mdx?: MdxOptions
}

/**
 * Schema execution context.
 *
 * Available during schema parsing via `context()`. All fields are accessible
 * to both built-in and user-defined schemas — there is no internal-only tier.
 */
export interface SchemaContext<T extends Collections = Collections> {
  readonly project: ProjectInfo<T>
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
  /** Engine-scoped asset processing cache (deduplicates asset reads). */
  readonly assetCache: AssetProcessingCache
  /** Session-scoped store for asset records emitted this build. */
  readonly assetStore: AssetStore
  /** Declare a schema effect (unique registration, asset reference, etc.). */
  readonly collectEffect: (effect: Effect) => void
}

export interface RunWithContextInput {
  readonly project: Project
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
  readonly assetCache: AssetProcessingCache
  readonly assetStore: AssetStore
  readonly collectEffect: (effect: Effect) => void
}

const als = new AsyncLocalStorage<SchemaContext>()

const MISSING = 'Missing schema context — are you calling context() outside of a schema parse?'

/**
 * Get the schema context for the current record parse.
 *
 * @throws when called outside of a schema parse.
 */
export const context = (): SchemaContext => {
  const ctx = als.getStore()
  if (ctx == null) throw new Error(MISSING)
  return ctx
}

/** Run `run` inside a schema context for a single record parse. */
export const runWithContext = <R>(input: RunWithContextInput, run: () => R): R => {
  const { project } = input
  const ctx: SchemaContext = {
    project: {
      root: project.root,
      configPath: project.config.path,
      collections: project.collections,
      output: project.output,
      markdown: project.markdown,
      mdx: project.mdx
    },
    file: input.file,
    record: input.record,
    store: input.store,
    assetCache: input.assetCache,
    assetStore: input.assetStore,
    collectEffect: input.collectEffect
  }
  return als.run(ctx, run)
}
