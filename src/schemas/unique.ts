import { string } from './zod'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  string().superRefine((value, { path, meta, addIssue }) => {
    const key = `schemas:unique:${by}:${value}`
    const { cache } = meta.config
    if (cache.has(key)) {
      addIssue({ fatal: true, code: 'custom', message: `duplicate value '${value}' in '${meta.path}:${path.join('.')}'` })
    } else {
      cache.set(key, meta.path)
    }
  })
