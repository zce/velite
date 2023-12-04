import { z } from 'zod'

import { getFile } from '../file'

/**
 * A image path relative to this file.
 */
export const image = () =>
  z.string().transform((value, ctx) => {
    const file = getFile(ctx.path[0] as string)
    if (file == null) throw new Error(`file not found: ${ctx.path[0]}`)
    return file.outputAsset(value)
  })
