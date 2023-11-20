import { excerpt as hastExcerpt } from 'hast-util-excerpt'
import { truncate } from 'hast-util-truncate'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

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

// prettier-ignore
const rehypeExtractExcerpt: Plugin<[Omit<ExcerptOptions, 'format'>], Root> = ({ separator, length }) => (tree, file) => {
  if (separator != null) {
    tree = hastExcerpt(tree, { comment: separator }) ?? tree
  } else if (length != null) {
    tree = truncate(tree, { size: length, ellipsis: '…' })
  }

  const lines: string[] = []
  visit(tree, 'text', node => {
    lines.push(node.value)
  })

  file.data.excerpt = lines.join('').trim()

  return tree
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
