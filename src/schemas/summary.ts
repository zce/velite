import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

import { custom } from '../zod'

export interface SummaryOptions {
  /**
   * Summary length.
   * @default 260
   */
  length?: number
}

export const summary = ({ length = 260 }: SummaryOptions = {}) =>
  custom<string>().transform(async (value, ctx) => {
    const { file } = ctx.meta
    if (value == null && file.data.content != null) {
      value = file.data.content
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
