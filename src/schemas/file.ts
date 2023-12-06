import { z } from 'zod'

import { processAsset } from '../assets'

/**
 * A file path relative to this file.
 */
export const file = () =>
  z.string().transform((value, ctx) =>
    processAsset(value, ctx.path[0] as string).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
