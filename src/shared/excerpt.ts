import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { z } from 'zod'

import rehypeExtractExcerpt from '../plugins/rehype-extract-excerpt'

export interface ExcerptOptions {
  /**
   * Excerpt separator.
   * @example
   * excerpt({ separator: 'more' }) // split excerpt by `<!-- more -->`
   */
  separator?: string
  /**
   * Excerpt length.
   * @default 200
   */
  length?: number
  /**
   * Excerpt format.
   * @default 'plain'
   */
  format?: 'plain' | 'html'
}

export const excerpt = ({ separator, length = 200, format = 'plain' }: ExcerptOptions = {}) =>
  z.string().transform(async (value, ctx) => {
    try {
      const file = await unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeExtractExcerpt, { separator, length })
        .use(rehypeStringify)
        .process({ value })

      if (format === 'plain') return file.data.excerpt as string
      return file.toString()
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
