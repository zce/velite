import { AsyncLocalStorage } from 'node:async_hooks'

import { createSessionStore } from './store'

import type { Schema } from '../schemas'
import type { Config } from '../types'
import type { VeliteFile } from './file'
import type { SessionStore } from './store'

/**
 * Context available during schema parsing.
 *
 * The shape is intentionally minimal: it carries the resolved config, the
 * current file being parsed, and a session-scoped `SessionStore` through
 * which schemas read or create their own per-build state. Nothing here is
 * specific to any one schema, so the public type stays stable as new schemas
 * are added.
 */
export interface ParserContext {
  /** Resolved config being used. */
  readonly config: Config
  /** Current file being parsed. */
  readonly file: VeliteFile
  /** Session-scoped registry for schema-owned state. */
  readonly store: SessionStore
}

/**
 * Optional shape accepted by `parseWithContext()`.
 *
 * Callers may omit `store`; an empty store is created. Useful for ad-hoc
 * `parseWithContext()` calls in tests where no session is involved.
 */
export interface ParserContextInput {
  readonly config: Config
  readonly file: VeliteFile
  readonly store?: SessionStore
}

const als = new AsyncLocalStorage<ParserContext>()

/**
 * Get the parser context for the current parse.
 *
 * @throws when called outside of a `parseWithContext()` call.
 */
export const context = (): ParserContext => {
  const ctx = als.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

/**
 * Run `schema.safeParseAsync(data)` with the given context bound to
 * `AsyncLocalStorage`. All `context()` calls inside the parse, and inside any
 * promise chains scheduled during it, see this context.
 */
export const parseWithContext = async (schema: Schema, data: unknown, input: ParserContextInput) => {
  const ctx: ParserContext = {
    config: input.config,
    file: input.file,
    store: input.store ?? createSessionStore()
  }
  return als.run(ctx, () => schema.safeParseAsync(data))
}
