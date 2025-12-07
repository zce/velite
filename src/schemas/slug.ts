import { string } from 'zod'

import { currentFile } from './zod'

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
    .superRefine((value, ctx) => {
      const key = `schemas:slug:${by}:${value}`
      const { cache } = currentFile().config
      if (cache.has(key)) {
        ctx.addIssue({ fatal: true, code: 'custom', message: `duplicate slug '${value}' in '${currentFile().path}'` })
      } else {
        cache.set(key, currentFile().path)
      }
    })
