import { z } from 'zod'

import { markdownToPlain } from './utils'

export interface SummaryOptions {
  /**
   * Summary length.
   * @default 260
   */
  length?: number
}

export const summary = ({ length = 260 }: SummaryOptions = {}) =>
  z.string().transform((value, ctx) => {
    try {
      return markdownToPlain(value).replace(/\s+/g, ' ').slice(0, length)
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return ''
    }
  })
