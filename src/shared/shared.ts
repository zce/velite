import z from 'zod'

import { cache } from '../context'
import { outputFile, outputImage } from '../static'

const reservedSlugs = [
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'subscribe',
  'admin',
  'dashboard',
  'settings',
  'archive',
  'labs',
  'blog',
  'learn',
  'authors',
  'categories',
  'tags',
  'docs'
]

/**
 * generate a slug schema
 * @param uniqueBy uniqueBy is used to create a unique set of slugs
 * @returns slug schema
 */
export const slug = (uniqueBy: string = 'global') =>
  z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reservedSlugs.includes(value), 'Reserved slug')
    .refine(value => {
      const cacheKey = `slugs:${uniqueBy}`
      const slugs = cache.get(cacheKey)
      if (slugs == null) {
        cache.set(cacheKey, new Set())
        return true
      }
      if (slugs.has(value)) {
        return false
      }
      slugs.add(value)
      return true
    }, 'Slug already existSlugs')

export const name = () => z.string().max(20)

export const title = () => z.string().max(99)

export const isodate = () =>
  z
    .string()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date')
    .transform(value => new Date(value).toISOString())

export const paragraph = () => z.string().max(999)
export const meta = () =>
  z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional()
    })
    .default({})

// TODO
export const excerpt = () => z.string().transform(value => value.slice(0, 200))

export const file = () =>
  z.string().transform((value, ctx) =>
    outputFile(value, ctx.path[0] as string).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )

export const image = () =>
  z.string().transform((value, ctx) =>
    outputImage(value, ctx.path[0] as string).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )

// TODO
export const demo = () => z.custom().transform(value => Date.now())

export { markdown } from './markdown'
