import { z } from 'zod'

import { cache } from '../cache'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  z.string().refine(value => {
    if (cache.has(`REFRESH:schemas:unique:${by}:${value}`)) return false
    cache.set(`REFRESH:schemas:unique:${by}:${value}`, true)
    return true
  }, 'Already exists')
