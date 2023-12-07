import { processAsset } from '../assets'
import { string } from '../zod'

/**
 * A file path relative to this file.
 */
export const file = () =>
  string().transform((value, ctx) =>
    processAsset(value, ctx.meta.file.path).catch(err => {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    })
  )
