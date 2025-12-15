import { AsyncLocalStorage } from 'node:async_hooks'

import type { VeliteFile } from './file'
import type { Schema } from './schemas'
import type { Config } from './types'

/**
 * Context in pipeline
 */
export interface Context {
  /**
   * Resolved config being used
   */
  readonly config: Config
  /**
   * Current file being parsed
   */
  readonly file: VeliteFile
}

const store = new AsyncLocalStorage<Context>()

/**
 * Get current context in pipeline
 */
export const context = () => {
  const ctx = store.getStore()
  if (ctx) return ctx
  throw new Error('Missing parser context')
}

/**
 * Run safeParse with context injected.
 */
export const parseWithContext = async (schema: Schema, data: unknown, context: Context) => {
  return store.run(context, () => schema.safeParseAsync(data))
}
