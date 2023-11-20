import { readingTime } from 'hast-util-reading-time'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { z } from 'zod'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

export interface MetadataOptions {
  /**
   * Age of the reader.
   * @default 22
   */
  age: number
}

// prettier-ignore
const rehypeMetadata: Plugin<[MetadataOptions], Root> = ({ age }) => (tree, file) => {
  file.data.readingTime = Math.ceil(readingTime(tree, { age }))
}

/**
 * Document metadata.
 */
export interface Metadata {
  /**
   * Reading time in minutes.
   */
  readingTime: number
}

export const metadata = ({ age = 22 }: MetadataOptions) =>
  z.string().transform(async (value, ctx) => {
    try {
      const file = await unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeMetadata, { age: age })
        .use(rehypeStringify)
        .process(value)
      return file.data as unknown as Metadata
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
