import { AsyncLocalStorage } from 'node:async_hooks'

import { createSessionStore } from './store'

import type { VeliteFile } from '../collections/file'
import type { Config } from '../config'
import type { SessionStore } from './store'

/** Public context available during schema parsing. */
export interface ParserContext {
  /** Resolved config being used. */
  readonly config: Config
  /** Current file being parsed. */
  readonly file: VeliteFile
  /** Session-scoped registry for custom schema state. */
  readonly store: SessionStore
}

interface ParserContextInput {
  readonly config: Config
  readonly file: VeliteFile
  readonly store?: SessionStore
}

const als = new AsyncLocalStorage<ParserContext>()

/**
 * Get the parser context for the current parse.
 *
 * @throws when called outside of a `runWithContext()` call.
 */
export const context = (): ParserContext => {
  const ctx = als.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

export const runWithContext = <T>(input: ParserContextInput, run: () => T): T => {
  const ctx: ParserContext = {
    config: input.config,
    file: input.file,
    store: input.store ?? createSessionStore()
  }
  return als.run(ctx, run)
}
