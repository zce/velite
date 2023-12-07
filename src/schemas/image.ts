import { processAsset } from '../assets'
import { string } from '../zod'

/**
 * A image path relative to this file.
 */
export const image = () =>
  string().transform((value, ctx) =>
    processAsset(value, ctx.meta.file.path, true).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
