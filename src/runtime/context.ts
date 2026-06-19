import { AsyncLocalStorage } from 'node:async_hooks'

import { createBuildStore } from './store'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
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

interface BuildContextInput<T extends Collections = Collections> {
  readonly config: ResolvedConfig<T>
  readonly file: ContentFile
  readonly store?: BuildStore
}

const als = new AsyncLocalStorage<BuildContext<any>>()

/**
 * Get the build context for the current schema parse.
 *
 * @throws when called outside of a schema parse.
 */
export const context = (): BuildContext => {
  const ctx = als.getStore()
  if (ctx) return ctx
  throw new Error('Missing build context — are you calling context() outside of a schema parse?')
}

export const runWithContext = <T extends Collections, R>(input: BuildContextInput<T>, run: () => R): R => {
  const ctx: BuildContext<T> = {
    config: input.config,
    file: input.file,
    store: input.store ?? createBuildStore()
  }
  return als.run(ctx, run)
}
