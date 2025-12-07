import { string } from 'zod'

import { currentFile } from './zod'

/**
 * generate a unique schema
 * @param by unique by
 * @returns unique schema
 */
export const unique = (by: string = 'global') =>
  string().superRefine((value, ctx) => {
    const key = `schemas:unique:${by}:${value}`
    const { cache } = currentFile().config
    if (cache.has(key)) {
      ctx.addIssue({ fatal: true, code: 'custom', message: `duplicate value '${value}' in '${currentFile().path}'` })
    } else {
      cache.set(key, currentFile().path)
    }
  })
