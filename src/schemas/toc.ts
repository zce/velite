import { toc as extractToc, Options, Result } from 'mdast-util-toc'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { custom } from './zod'

/**
 * Options for table of contents
 * extraction
 */
export interface TocOptions extends Options {}

/**
 * Table of contents result type
 */
export interface Toc extends Result {}

export const toc = (options?: TocOptions) =>
  custom<string>().transform<Toc>(async (value, { meta: { file }, addIssue }) => {
    if (value == null && file.data.content != null) {
      value = file.data.content
    }

    try {
      // extract ast tree from markdown/mdx content
      // TODO: understand if is possible to reuse tree from markdown/mdx schema
      const tree = await unified().use(remarkParse).parse({ value, path: file.path })
      return extractToc(tree, options) // run toc extraction
    } catch (err: any) {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    }
  })
