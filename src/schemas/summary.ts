import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'
import { z } from 'zod'

import { loaded } from '../cache'

export interface SummaryOptions {
  /**
   * Summary length.
   * @default 260
   */
  length?: number
}

export const summary = ({ length = 260 }: SummaryOptions = {}) =>
  z.custom<string>().transform(async (value, ctx) => {
    const path = ctx.path[0] as string
    if (value == null && loaded.has(path)) {
      value = loaded.get(path)!.data.content!
    }

    try {
      const mdast = fromMarkdown(value)
      const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
      const content = toString(hast)
      return content.replace(/\s+/g, ' ').slice(0, length)
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return ''
    }
  })
