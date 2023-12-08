import { string } from './zod'

const cache = new Map<string, boolean>()

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  string().refine(value => {
    if (cache.has(`${by}:${value}`)) return false
    cache.set(`${by}:${value}`, true)
    return true
  }, 'Already exists')
