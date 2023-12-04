import { z } from 'zod'

import { getFile } from '../file'

/**
 * A file path relative to this file.
 */
export const file = () =>
  z.string().transform((value, ctx) => {
    const file = getFile(ctx.path[0] as string)
    if (file == null) throw new Error(`file not found: ${ctx.path[0]}`)
    return file.outputAsset(value)
  })

// outputFile(value, ctx.path[0] as string).catch(err => {
//   ctx.addIssue({ code: 'custom', message: err.message })
//   return value
// })
