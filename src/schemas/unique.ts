import { z } from 'zod'

import { getConfig } from '../config'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  z.string().refine(value => {
    const { cache } = getConfig()
    if (cache.has(`schemas:unique:${by}:${value}`)) return false
    cache.set(`schemas:unique:${by}:${value}`, true)
    return true
  }, 'Already exists')
