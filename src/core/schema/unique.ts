import { z } from 'zod'

import { context } from './context'

import type { Schema } from './s'

/**
 * Unique-value schema.
 *
 * Registers the value as a `unique` schema effect owned by the current record.
 * The pipeline's `uniqueCheck` derivation reports a duplicate diagnostic when
 * the same `(group, value)` is registered by more than one live record.
 *
 * @param group unique group namespace. @default 'global'
 */
export const unique = (group: string = 'global'): Schema<string> =>
  z.string().superRefine(value => {
    const { collectEffect, record } = context()
    collectEffect({ type: 'unique', owner: record.id, group, value })
  })

/**
 * Slug schema.
 *
 * Validates a URL-safe slug, rejects reserved values, and registers it in a
 * uniqueness group (prefixed with `slug:`) so duplicates across records are
 * flagged by `uniqueCheck`.
 *
 * @param group unique group namespace. @default 'global'
 * @param reserved reserved slugs that will be rejected.
 */
export const slug = (group: string = 'global', reserved: string[] = []): Schema<string> =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .and(unique(`slug:${group}`))
