import { z } from 'zod'

import { process } from '../assets'

/**
 * A file path relative to this file.
 */
export const file = () =>
  z.string().transform((value, ctx) =>
    process(value, ctx.path[0] as string).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
