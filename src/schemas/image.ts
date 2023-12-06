import { z } from 'zod'

import { processAsset } from '../assets'

/**
 * A image path relative to this file.
 */
export const image = () =>
  z.string().transform((value, ctx) =>
    processAsset(value, ctx.path[0] as string, true).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
