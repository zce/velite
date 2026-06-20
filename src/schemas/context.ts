import { AsyncLocalStorage } from 'node:async_hooks'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { AssetProcessingCache } from '../assets/cache'
import type { AssetStore } from '../assets/store'
import type { Collections } from '../collections'
import type { Project } from '../core/project'
import type { SessionStore } from '../core/session'
import type { Effect } from './effects'

/**
 * Public, read-mostly view of a content file during schema parsing.
 *
 * AST fields are intentionally not part of the stable 1.0 contract; users can
 * derive anything else they need from `path`.
 */
export interface ContentFile {
  readonly id: string
  readonly path: string
  readonly content?: string
  readonly plain?: string
}

/** Identity of the record currently being parsed within a multi-record source. */
export interface ContentRecord {
  readonly id: string
  readonly key?: string
  readonly index: number
}

/** Stable, public view of the resolved project exposed to schemas. */
export interface ProjectInfo<T extends Collections = Collections> {
  readonly root: string
  readonly configPath: string
  readonly collections: T
}

/** Public schema execution context. */
export interface SchemaContext<T extends Collections = Collections> {
  readonly project: ProjectInfo<T>
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
}

/** Internal content file carrying lazily-parsed AST for built-in schemas. */
export interface InternalFile extends ContentFile {
  readonly mdast?: Root
  readonly hast?: Nodes
}

/** Internal context with asset + effect plumbing used by built-in schemas. */
export interface InternalSchemaContext {
  readonly project: Project
  readonly file: InternalFile
  readonly record: ContentRecord
  readonly store: SessionStore
  readonly assetCache: AssetProcessingCache
  readonly assetStore: AssetStore
  readonly collectEffect: (effect: Effect) => void
}

export interface RunWithContextInput {
  readonly project: Project
  readonly file: InternalFile
  readonly record: ContentRecord
  readonly store: SessionStore
  readonly assetCache: AssetProcessingCache
  readonly assetStore: AssetStore
  readonly collectEffect: (effect: Effect) => void
}

const als = new AsyncLocalStorage<InternalSchemaContext>()

const MISSING = 'Missing schema context — are you calling context() outside of a schema parse?'

/**
 * Get the public schema context for the current record parse.
 *
 * @throws when called outside of a schema parse.
 */
export const context = (): SchemaContext => {
  const ctx = als.getStore()
  if (ctx == null) throw new Error(MISSING)
  return {
    project: { root: ctx.project.root, configPath: ctx.project.configPath, collections: ctx.project.collections },
    file: { id: ctx.file.id, path: ctx.file.path, content: ctx.file.content, plain: ctx.file.plain },
    record: ctx.record,
    store: ctx.store
  }
}

/** Internal: full context including asset cache, asset store and effect sink. */
export const getContext = (): InternalSchemaContext => {
  const ctx = als.getStore()
  if (ctx == null) throw new Error(MISSING)
  return ctx
}

/** Run `run` inside a schema context for a single record parse. */
export const runWithContext = <R>(input: RunWithContextInput, run: () => R): R => {
  const ctx: InternalSchemaContext = {
    project: input.project,
    file: input.file,
    record: input.record,
    store: input.store,
    assetCache: input.assetCache,
    assetStore: input.assetStore,
    collectEffect: input.collectEffect
  }
  return als.run(ctx, run)
}
