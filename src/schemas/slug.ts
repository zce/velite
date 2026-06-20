import * as z from 'zod'

import { unique } from './unique'

/**
 * Slug schema.
 *
 * Validates a URL-safe slug, rejects reserved values, and registers it in a
 * uniqueness group so duplicates across records are flagged.
 *
 * @param group unique group namespace. @default 'global'
 * @param reserved reserved slugs that will be rejected.
 */
export const slug = (group: string = 'global', reserved: string[] = []): z.ZodType<string> =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .and(unique(`slug:${group}`))
