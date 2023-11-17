import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import z from 'zod'

import rehypeCopyLinkedFiles from '../plugins/rehype-copy-linked-files'
import rehypeExtractExcerpt from '../plugins/rehype-extract-excerpt'
import rehypeMetadata from '../plugins/rehype-metadata'
import remarkFlattenImage from '../plugins/remark-flatten-image'
import remarkFlattenListItem from '../plugins/remark-flatten-listitem'
import remarkRemoveComments from '../plugins/remark-remove-comments'

import type { PluggableList } from 'unified'

export interface MarkdownOptions {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Flatten image paragraph.
   * @default true
   */
  flattenImage?: boolean
  /**
   * Flatten list item paragraph.
   * @default true
   */
  flattenListItem?: boolean
  /**
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}

export const markdown = ({ gfm = true, removeComments = true, flattenImage = true, flattenListItem = true, remarkPlugins, rehypePlugins }: MarkdownOptions = {}) =>
  z.string().transform(async (value, ctx) => {
    const file = unified().use(remarkParse) // parse markdown content to a syntax tree
    if (gfm) file.use(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) file.use(remarkRemoveComments) // remove html comments
    if (flattenImage) file.use(remarkFlattenImage) // flatten image paragraph
    if (flattenListItem) file.use(remarkFlattenListItem) // flatten list item paragraph
    if (remarkPlugins != null) file.use(remarkPlugins) // apply remark plugins
    file.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw) // turn markdown syntax tree to html syntax tree, with raw html support
    if (rehypePlugins != null) file.use(rehypePlugins) // apply rehype plugins
    file.use(rehypeCopyLinkedFiles) // copy linked files to public path and replace their urls with public urls
    // file.use(rehypeExtractExcerpt) // extract excerpt and plain into file.data
    // if (process.env.NODE_ENV === 'production') file.use(rehypePresetMinify) // minify html syntax tree
    file.use(rehypeStringify) // serialize html syntax tree
    try {
      const html = await file.process({ value, path: ctx.path[0] as string })
      return html.toString()
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })

export interface MetadataOptions {
  /**
   * Age of the reader.
   * @default 22
   */
  age: number
}

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

      if (format === 'plain') return file.data.plain
      return file.toString()
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
