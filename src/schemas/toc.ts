import { Link, List, Paragraph } from 'mdast'
import { toc as extractToc, Options, Result } from 'mdast-util-toc'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { custom } from './zod'

/**
 * Options for table of contents
 * extraction
 */
export interface TocOptions extends Options {}

/**
 * Entry for a table of contents
 * with title, url and items
 */
export interface TocEntry {
  /**
   * Title of the entry
   */
  title: string
  /**
   * URL that can be used to reach
   * the content
   */
  url: string
  /**
   * Nested items
   */
  items: TocEntry[]
}

/**
 * Table of contents
 * with parsed entries and
 * original tree
 */
export interface Toc {
  /**
   * Parsed entries
   */
  entries: TocEntry[]
  /**
   * Original AST tree that can be
   * used for custom parsing or rendering
   */
  tree: Result
}

function parseParagraph(node: Paragraph): Omit<TocEntry, 'items'> {
  if (node.type !== 'paragraph') return { title: '', url: '' }
  let extraction = { title: '', url: '' }

  visit(node, 'link', (link: Link) => {
    extraction.url = link.url
  })

  visit(node, ['text', 'emphasis', 'strong', 'inlineCode'], text => {
    // @ts-ignore Doesn't care about test
    extraction.title += text.value
  })

  return extraction
}

function parse(tree?: List): TocEntry[] {
  if (!tree || tree?.type !== 'list') return []

  const layer = tree.children.flatMap(node => node.children)
  const entries = layer.flatMap((node, index) => {
    if (node.type === 'paragraph')
      return [
        {
          ...parseParagraph(node),
          items: parse(layer[index + 1] as List) // Safe, next node can be either a list or a paragraph
        }
      ]

    return []
  })

  return entries
}

export const toc = (options?: TocOptions) =>
  custom<string>().transform<Toc>(async (value, { meta: { path, content }, addIssue }) => {
    if (value == null && content != null) {
      value = content
    }

    try {
      // extract ast tree from markdown/mdx content
      // TODO: understand if is possible to reuse tree from markdown/mdx schema
      const tree = unified().use(remarkParse).parse({ value, path })
      const tocTree = extractToc(tree, options) // run toc extraction
      return { tree: tocTree, entries: parse(tocTree.map) }
    } catch (err: any) {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    }
  })
