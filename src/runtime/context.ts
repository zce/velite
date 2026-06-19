import { AsyncLocalStorage } from 'node:async_hooks'

import { createAssetProcessingCache } from '../assets/cache'
import { createBuildStore } from './store'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
import type { AssetProcessingCache } from '../assets/cache'
import type { Collections } from '../collections'
import type { ResolvedConfig } from '../config'
import type { BuildStore } from './store'

export interface ContentFile {
  readonly path: string
  readonly content?: string
  readonly plain?: string
  readonly mdast?: Root
  readonly hast?: Nodes
}

/** Public context available during schema parsing. */
export interface BuildContext<T extends Collections = Collections> {
  /** Resolved config being used. */
  readonly config: ResolvedConfig<T>
  /** Current file being parsed. */
  readonly file: ContentFile
  /** Build-scoped shared state for advanced custom schemas and plugins. */
  readonly store: BuildStore
}

/**
 * Internal-only extension of `BuildContext` that carries the engine-scoped
 * asset processing cache. This shape is never returned from the public
 * `context()` helper and must not be exposed through the public API.
 */
interface InternalBuildContext<T extends Collections = Collections> extends BuildContext<T> {
  readonly assetCache: AssetProcessingCache
}

interface BuildContextInput<T extends Collections = Collections> {
  readonly config: ResolvedConfig<T>
  readonly file: ContentFile
  readonly store?: BuildStore
  readonly assetCache?: AssetProcessingCache
}

const als = new AsyncLocalStorage<InternalBuildContext<any>>()

const MISSING = 'Missing build context — are you calling context() outside of a schema parse?'

/**
 * Get the build context for the current schema parse.
 *
 * @throws when called outside of a schema parse.
 */
export const context = (): BuildContext => {
  const ctx = als.getStore()
  if (ctx == null) throw new Error(MISSING)
  return { config: ctx.config, file: ctx.file, store: ctx.store }
}

/**
 * Internal helper: returns the engine-scoped asset processing cache.
 *
 * @throws when called outside of a schema parse.
 */
export const getInternalAssetCache = (): AssetProcessingCache => {
  const ctx = als.getStore()
  if (ctx == null) throw new Error(MISSING)
  return ctx.assetCache
}

export const runWithContext = <T extends Collections, R>(input: BuildContextInput<T>, run: () => R): R => {
  const ctx: InternalBuildContext<T> = {
    config: input.config,
    file: input.file,
    store: input.store ?? createBuildStore(),
    assetCache: input.assetCache ?? createAssetProcessingCache()
  }
  return als.run(ctx, run)
}
