import { string } from './zod'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  string().superRefine((value, { path, meta: { path: filepath, config }, addIssue }) => {
    const key = `schemas:unique:${by}:${value}`
    if (config.cache.has(key)) {
      addIssue({ code: 'custom', message: `duplicate value '${value}' in '${filepath}:${path.join('.')}'` })
    } else {
      config.cache.set(key, filepath)
    }
  })
