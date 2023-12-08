import { string } from './zod'

const cache = new Map<string, string>()

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
      const path = ctx.meta.file.path + ':' + ctx.path.join('.')
      if (cache.has(key)) {
        if (path !== cache.get(key)) {
          ctx.addIssue({ code: 'custom', message: 'Slug already exists in ' + cache.get(key) })
        }
      } else {
        cache.set(key, path)
      }
    })
// rebuild cache cause not every file is processed
// .refine(value => {
//   if (cache.has(`schemas:slug:${by}:${value}`)) return false
//   cache.set(`schemas:slug:${by}:${value}`, true)
//   return true
// }, 'Slug already exists')
