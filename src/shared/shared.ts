import z from 'zod'

import { cache } from '../context'
import { outputFile, outputImage } from '../static'

/**
 * generate a slug schema
 * @param uniqueBy uniqueBy is used to create a unique set of slugs
 * @param reservedSlugs reserved slugs, will be rejected
 * @returns slug schema
 */
export const slug = (uniqueBy: string = 'global', reservedSlugs: string[] = []) =>
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

export const isodate = () =>
  z
    .string()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date')
    .transform(value => new Date(value).toISOString())

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

// // TODO
// export const demo = () => z.custom().transform(value => Date.now())

export * from './markdown'
