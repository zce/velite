import { Link, List, Paragraph } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toc as extractToc } from 'mdast-util-toc'
import { visit } from 'unist-util-visit'

import { custom } from './zod'

import type { Options } from 'mdast-util-toc'

/**
 * Options for table of contents
 * extraction
 */
export interface TocOptions extends Options {
  /**
   * keep the original tree
   */
  original?: boolean
}

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
 * Tree for table of contents
 */
export interface TocTree {
  /**
   *  Index of the node right after the table of contents heading, `-1` if no
   *  heading was found, `undefined` if no `heading` was given.
   */
  index?: number
  /**
   *  Index of the first node after `heading` that is not part of its section,
   *  `-1` if no heading was found, `undefined` if no `heading` was given, same
   *  as `index` if there are no nodes between `heading` and the first heading
   *  in the table of contents.
   */
  endIndex?: number
  /**
   *  List representing the generated table of contents, `undefined` if no table
   *  of contents could be created, either because no heading was found or
   *  because no following headings were found.
   */
  map?: List
}

const parseParagraph = (node: Paragraph): Omit<TocEntry, 'items'> => {
  if (node.type !== 'paragraph') return { title: '', url: '' }
  const extraction = { title: '', url: '' }

  visit(node, 'link', (link: Link) => {
    extraction.url = link.url
  })

  visit(node, ['text', 'emphasis', 'strong', 'inlineCode'], text => {
    // @ts-ignore Doesn't care about test
    extraction.title += text.value
  })

  return extraction
}

const parse = (tree?: List): TocEntry[] => {
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

export const toc = <T extends TocOptions>(options?: T) =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<T extends { original: true } ? TocTree : TocEntry[]>(
    async (value, { meta, addIssue }) => {
      value = value ?? meta.content
      if (value == null || value.length === 0) {
        addIssue({ code: 'custom', message: 'The content is empty' })
        return (options?.original ? {} : []) as T extends { original: true } ? TocTree : TocEntry[]
      }
      try {
        // extract ast tree from markdown/mdx content
        const tree = value != null ? fromMarkdown(value) : meta.mdast
        if (tree == null) throw new Error('No tree found')
        const tocTree = extractToc(tree, options)
        // return the original tree if requested
        if (options?.original) return tocTree as T extends { original: true } ? TocTree : TocEntry[]
        return parse(tocTree.map) as T extends { original: true } ? TocTree : TocEntry[]
      } catch (err: any) {
        addIssue({ fatal: true, code: 'custom', message: err.message })
        return null as never
      }
    }
  )
