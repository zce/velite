import { AsyncLocalStorage } from 'node:async_hooks'

import type { VeliteFile } from './file'
import type { Schema } from './schemas'
import type { Config } from './types'

/**
 * Context available during schema parsing.
 */
export interface ParserContext {
  /**
   * Resolved config being used.
   */
  readonly config: Config
  /**
   * Current file being parsed.
   */
  readonly file: VeliteFile
}

const store = new AsyncLocalStorage<ParserContext>()

/**
 * Get current parser context.
 */
export const context = (): ParserContext => {
  const ctx = store.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

/**
 * Run safeParse with context injected.
 */
export const parseWithContext = async (schema: Schema, data: unknown, context: ParserContext) => {
  return store.run(context, () => schema.safeParseAsync(data))
}
