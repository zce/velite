import { z } from 'zod'

import { outputImage } from '../assets'

/**
 * A image path relative to this file.
 */
export const image = () =>
  z.string().transform((value, ctx) =>
    outputImage(value, ctx.path[0] as string).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
