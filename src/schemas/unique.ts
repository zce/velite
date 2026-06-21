import * as z from 'zod'

import { context } from './context'

/**
 * Unique-value schema.
 *
 * Registers the value as a `unique` schema effect owned by the current record.
 * The pipeline's effect-validation phase reports a duplicate diagnostic when
 * the same `(group, value)` is registered by more than one live record. This
 * keeps cross-file uniqueness correct under concurrent and incremental builds
 * without schemas mutating shared state directly.
 *
 * @param group unique group namespace. @default 'global'
 */
export const unique = (group: string = 'global'): z.ZodType<string> =>
  z.string().superRefine(value => {
    const ctx = context()
    ctx.collectEffect({ type: 'unique', owner: ctx.record.id, group, value })
  })
