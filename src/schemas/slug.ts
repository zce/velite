import { z } from 'zod'

import { getCache } from '../cache'

/**
 * generate a slug schema
 * @param unique unique by this, used to create a unique set of slugs
 * @param reserved reserved slugs, will be rejected
 * @returns slug schema
 */
export const slug = (unique: string = 'global', reserved: string[] = []) =>
  z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .refine(value => {
      const exists = getCache(`shared:slug:${unique}`, new Set())
      if (exists.has(value)) return false
      exists.add(value)
      return true
    }, 'Slug already exists')
