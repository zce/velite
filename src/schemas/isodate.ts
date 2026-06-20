import * as z from 'zod'

/**
 * ISO date string schema.
 *
 * Validates a parseable date string and normalizes it to a UTC ISO timestamp.
 */
export const isoDate = (): z.ZodType<string> =>
  z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date string')
    .transform<string>(value => new Date(value).toISOString())
