import { z } from 'zod'

import { outputFile, outputImage } from './static'

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
const exists = new Map<string, Set<string>>()

const uniqueSlug = (type: string) =>
  z
    .string()
    .min(3)
    .superRefine((value, ctx) => {
      if (reservedSlugs.includes(value)) {
        ctx.addIssue({ code: 'custom', message: 'Reserved slug' })
      }
      let set = exists.get(type)
      if (set == null) {
        set = new Set()
        exists.set(type, set)
      }
      if (set.has(value)) {
        ctx.addIssue({ code: 'custom', message: 'Slug already exists' })
      }
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value) === false) {
        ctx.addIssue({ code: 'custom', message: 'Invalid slug' })
      }
      set.add(value)
    })

// prettier-ignore
export const shared = {
  name: z.string().max(20),
  title: z.string().max(99),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
  date: z.string().refine(value => !isNaN(Date.parse(value)), 'Invalid date').transform(value => new Date(value).toISOString()),
  paragraph: z.string().max(999),
  meta: z.object({ title: z.string().optional(), description: z.string().optional(), keywords: z.array(z.string()).optional() }).default({}),
  file: z.string().transform((value, ctx) => outputFile(value, ctx.path[0] as string).catch(err => {
    ctx.addIssue({ code: 'custom', message: err.message })
    return value
  })),
  image: z.string().transform((value, ctx) => outputImage(value, ctx.path[0] as string).catch(err => {
    ctx.addIssue({ code: 'custom', message: err.message })
    return value
  })),
  uniqueSlug
}

export { z }
