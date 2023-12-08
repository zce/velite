import { cache } from '../cache'
import { string } from './zod'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  string().refine(value => {
    if (cache.has(`schemas:unique:${by}:${value}`)) return false
    cache.set(`schemas:unique:${by}:${value}`, true)
    return true
  }, 'Already exists')
