import { custom } from 'zod'

import { context } from '../context'

export interface ExcerptOptions {
  // /**
  //  * Excerpt separator.
  //  * @default 'more'
  //  * @example
  //  * s.excerpt({ separator: 'preview' }) // split excerpt by `<!-- preview -->`
  //  */
  // separator?: string
  /**
   * Excerpt length.
   * @default 260
   */
  length?: number
}

export const excerpt = ({ length = 260 }: ExcerptOptions = {}) =>
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      value = value ?? context().file.plain
      if (value == null || value.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }

      return value.slice(0, length)
    })
