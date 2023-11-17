import z from 'zod'

import { cache } from '../context'

/**
 * generate a slug schema
 * @param uniqueBy uniqueBy is used to create a unique set of slugs
 * @param reservedSlugs reserved slugs, will be rejected
 * @returns slug schema
 */
export const slug = (uniqueBy: string = 'global', reservedSlugs: string[] = []) =>
  z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reservedSlugs.includes(value), 'Reserved slug')
    .refine(value => {
      const cacheKey = `slugs:${uniqueBy}`
      const slugs = cache.get(cacheKey)
      if (slugs == null) {
        cache.set(cacheKey, new Set())
        return true
      }
      if (slugs.has(value)) {
        return false
      }
      slugs.add(value)
      return true
    }, 'Slug already existSlugs')
