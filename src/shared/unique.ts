import { z } from 'zod'

import { cache } from '../context'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  z.string().refine(value => {
    const key = `shared:unique:${by}`
    const exists = cache.get(key)
    if (exists == null) {
      cache.set(key, new Set())
      return true
    }
    if (exists.has(value)) {
      return false
    }
    exists.add(value)
    return true
  }, 'Already exists')
