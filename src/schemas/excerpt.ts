import * as z from 'zod'

import { getContext } from './context'

/** Options for the excerpt schema. */
export interface ExcerptOptions {
  /** Excerpt length. @default 260 */
  length?: number
}

/** Extract a plain-text excerpt from the current content. */
export const excerpt = ({ length = 260 }: ExcerptOptions = {}): z.ZodType<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const body = value ?? getContext().file.plain
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      return body.slice(0, length)
    })
