import { excerpt as hastExcerpt } from 'hast-util-excerpt'
import { raw } from 'hast-util-raw'
import { toHtml } from 'hast-util-to-html'
import { truncate } from 'hast-util-truncate'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'
import { z } from 'zod'

import { extractHastLinkedFiles } from '../assets'
import { getFile } from '../file'

export interface ExcerptOptions {
  /**
   * Excerpt separator.
   * @default 'more'
   * @example
   * s.excerpt({ separator: 'preview' }) // split excerpt by `<!-- preview -->`
   */
  separator?: string
  /**
   * Excerpt length.
   * @default 300
   */
  length?: number
}

export const excerpt = ({ separator = 'more', length = 300 }: ExcerptOptions = {}) =>
  z.custom<string>().transform(async (value, ctx) => {
    if (value == null) {
      value = getFile(ctx.path[0] as string).data.content!
    }
    try {
      const mdast = fromMarkdown(value)
      const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
      const exHast = hastExcerpt(hast, { comment: separator, maxSearchSize: 1024 })
      const output = exHast ?? truncate(hast, { size: length, ellipsis: '…' })
      await extractHastLinkedFiles(output, ctx.path[0] as string)
      return toHtml(output)
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
