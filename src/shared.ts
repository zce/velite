import { z } from 'zod'

import { outputFile, outputImage } from './static'

// prettier-ignore
export const shared = {
  name: z.string().max(20),
  title: z.string().max(99),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug'),
  date: z.string().transform(value => new Date(value).toISOString()),
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
}

export { z }
