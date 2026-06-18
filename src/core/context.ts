import { AsyncLocalStorage } from 'node:async_hooks'

import { createSessionStore } from './store'

import type { Schema } from '../schemas'
import type { Config } from '../types'
import type { VeliteFile } from './file'
import type { SessionStore } from './store'

/** Public context available during schema parsing. */
export interface ParserContext {
  /** Resolved config being used. */
  readonly config: Config
  /** Current file being parsed. */
  readonly file: VeliteFile
}

/** Internal context used by built-in schemas and core parsing. */
export interface InternalParserContext extends ParserContext {
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
}

export interface InternalParserContextInput extends ParserContextInput {
  readonly store: SessionStore
}

const als = new AsyncLocalStorage<InternalParserContext>()

/**
 * Get the parser context for the current parse.
 *
 * @throws when called outside of a `parseWithContext()` call.
 */
export const context = (): ParserContext => {
  const ctx = als.getStore()
  if (ctx) return { config: ctx.config, file: ctx.file }
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

/** Get the internal parser context, including the session store. */
export const internalContext = (): InternalParserContext => {
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
  const ctx: InternalParserContext = {
    config: input.config,
    file: input.file,
    store: createSessionStore()
  }
  return als.run(ctx, () => schema.safeParseAsync(data))
}

/** Run a parse with an explicit session store supplied by core. */
export const parseWithInternalContext = async (schema: Schema, data: unknown, input: InternalParserContextInput) => {
  return als.run(input, () => schema.safeParseAsync(data))
}
