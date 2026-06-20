import { visit } from 'unist-util-visit'
import * as z from 'zod'

import { getContext } from './context'

import type { Link, List, Paragraph } from 'mdast'
import type { Options } from 'mdast-util-toc'

/** Options for table-of-contents extraction. */
export interface TocOptions extends Options {
  /** Keep the original mdast toc tree instead of the parsed entry list. */
  original?: boolean
}

/** Entry for a table of contents with title, url and nested items. */
export interface TocEntry {
  title: string
  url: string
  items: TocEntry[]
}

/** Raw table-of-contents tree from `mdast-util-toc`. */
export interface TocTree {
  index?: number
  endIndex?: number
  map?: List
}

const parseParagraph = (node: Paragraph): Omit<TocEntry, 'items'> => {
  if (node.type !== 'paragraph') return { title: '', url: '' }
  const extraction = { title: '', url: '' }
  visit(node, 'link', (link: Link) => {
    extraction.url = link.url
  })
  visit(node, ['text', 'emphasis', 'strong', 'inlineCode'], text => {
    extraction.title += (text as { value: string }).value
  })
  return extraction
}

const parse = (tree?: List): TocEntry[] => {
  if (tree == null || tree.type !== 'list') return []
  const layer = tree.children.flatMap(node => node.children)
  return layer.flatMap((node, index) => {
    if (node.type === 'paragraph') {
      return [{ ...parseParagraph(node), items: parse(layer[index + 1] as List) }]
    }
    return []
  })
}

/** Extract a table of contents from the current content. */
export const toc = <T extends TocOptions = TocOptions>(options?: T) =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<T extends { original: true } ? TocTree : TocEntry[]>(async (value, ctx) => {
      const { file } = getContext()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return (options?.original ? {} : []) as T extends { original: true } ? TocTree : TocEntry[]
      }
      try {
        const { fromMarkdown } = await import('mdast-util-from-markdown')
        const { toc: extractToc } = await import('mdast-util-toc')
        const tree = fromMarkdown(body)
        const tocTree = extractToc(tree, options)
        if (options?.original) return tocTree as T extends { original: true } ? TocTree : TocEntry[]
        return parse(tocTree.map) as T extends { original: true } ? TocTree : TocEntry[]
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
