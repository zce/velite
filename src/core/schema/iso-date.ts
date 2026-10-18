import { z } from 'zod'

import type { Schema } from './s'

/**
 * ISO date string schema.
 *
 * Validates a parseable date string and normalizes it to a UTC ISO timestamp.
 * Pure: no context, no I/O — safe to use in any runtime-agnostic schema.
 */
export const isoDate = (): Schema<string> =>
  z
    .string()
    .refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date string')
    .transform<string>(value => new Date(value).toISOString())
