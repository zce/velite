import { z } from 'zod'

import { getCache } from '../cache'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  z.string().refine(value => {
    const exists = getCache(`schemas:unique:${by}`, new Set())
    if (exists.has(value)) return false
    exists.add(value)
    return true
  }, 'Already exists')
