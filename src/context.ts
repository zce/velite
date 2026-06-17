import { AsyncLocalStorage } from 'node:async_hooks'

import type { VeliteFile } from './file'
import type { Schema } from './schemas'
import type { Config } from './types'

/**
 * Context available during schema parsing
 */
export interface ParserContext {
  /**
   * Resolved config being used
   */
  readonly config: Config
  /**
   * Current file being parsed
   */
  readonly file: VeliteFile
}

const store = new AsyncLocalStorage<ParserContext>()

/**
 * Get current parser context
 * @description
 * Use this inside custom schemas to access the current file and resolved config.
 * Must be called during schema parsing (e.g. inside a `.transform()` callback).
 * @returns current parser context
 * @example
 * import { context, defineSchema, s } from 'velite'
 *
 * const sourcePath = defineSchema(() =>
 *   s.custom<string>(value => typeof value === 'string')
 *     .optional()
 *     .transform(() => context().file.path)
 * )
 */
export const context = (): ParserContext => {
  const ctx = store.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context — are you calling context() outside of a schema parse?')
}

/**
 * Run a callback with parser context injected via AsyncLocalStorage
 * @param ctx parser context
 * @param fn callback to run
 * @returns result of the callback
 */
export const runWithContext = <T>(ctx: ParserContext, fn: () => T): T => {
  return store.run(ctx, fn)
}

/**
 * Run schema parse with context injected via AsyncLocalStorage
 * @param schema schema to parse with
 * @param data data to parse
 * @param ctx parser context
 * @returns safe parse result
 */
export const parseWithContext = async (schema: Schema, data: unknown, ctx: ParserContext) => {
  return store.run(ctx, () => schema.safeParseAsync(data))
}
