import { string } from './zod'

const cache = new Map<string, boolean>()

/**
 * generate a slug schema
 * @param by unique by this, used to create a unique set of slugs
 * @param reserved reserved slugs, will be rejected
 * @returns slug schema
 */
export const slug = (by: string = 'global', reserved: string[] = []) =>
  string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
    .refine(value => {
      // TODO: not working in rebuild
      if (cache.has(`${by}:${value}`)) return false
      cache.set(`${by}:${value}`, true)
      return true
    }, 'Slug already exists')
