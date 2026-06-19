import { AsyncLocalStorage } from 'node:async_hooks'

import { createBuildStore } from './store'

import type { Nodes } from 'hast'
import type { Root } from 'mdast'
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
export interface BuildContext {
  /** Resolved config being used. */
  readonly config: ResolvedConfig
  /** Current file being parsed. */
  readonly file: ContentFile
  /** Build-scoped shared state for advanced custom schemas and plugins. */
  readonly store: BuildStore
}

interface BuildContextInput {
  readonly config: ResolvedConfig
  readonly file: ContentFile
  readonly store?: BuildStore
}

const als = new AsyncLocalStorage<BuildContext>()

/**
 * Get the parser context for the current parse.
 *
 * @throws when called outside of a `runWithContext()` call.
 */
export const context = (): BuildContext => {
  const ctx = als.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

export const internalContext = context

export const runWithContext = <T>(input: BuildContextInput, run: () => T): T => {
  const ctx: BuildContext = {
    config: input.config,
    file: input.file,
    store: input.store ?? createBuildStore()
  }
  return als.run(ctx, run)
}
