// Markdown reference helpers: AST parsing, reference discovery, plain-text
// extraction and table-of-contents extraction.
//
// Runtime-agnostic: depends only on `mdast-util-from-markdown` and
// `unist-util-visit` (all pure, bundled devDeps). No node: builtins, no I/O.
//
// `parseMarkdown` returns a CommonMark mdast tree — no GFM, no plugins.
// It is the shared base parse for toc/excerpt/references; schemas that need
// their own plugin pipeline (e.g. s.markdown with gfm) re-parse independently.

import { fromMarkdown } from 'mdast-util-from-markdown'
import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'

type ReferenceKind = 'image' | 'link'

/** A local resource referenced from markdown / mdx body content. */
export interface ContentReference {
  kind: ReferenceKind
  url: string
  alt?: string
}

const isLocal = (url: string): boolean =>
  !url.startsWith('http://') &&
  !url.startsWith('https://') &&
  !url.startsWith('//') &&
  !url.startsWith('#') &&
  !url.startsWith('mailto:') &&
  !url.startsWith('tel:')

/** Collect relative image and link references from an mdast tree. */
export const findReferences = (tree: Root): ContentReference[] => {
  const refs: ContentReference[] = []
  visit(tree, node => {
    if (node.type === 'image' && 'url' in node && typeof node.url === 'string' && isLocal(node.url)) {
      refs.push({ kind: 'image', url: node.url, alt: 'alt' in node ? String(node.alt ?? '') : undefined })
    }
    if (node.type === 'link' && 'url' in node && typeof node.url === 'string' && isLocal(node.url)) {
      refs.push({ kind: 'link', url: node.url })
    }
  })
  return refs
}

/** Plain-text excerpt from an mdast tree. */
export const extractText = (tree: Root, maxLength = 200): string => {
  const parts: string[] = []
  visit(tree, node => {
    if (node.type === 'text' && 'value' in node) parts.push(String(node.value))
  })
  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

export interface TocItem {
  depth: number
  title: string
  slug: string
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')

/** Extract a table of contents from heading nodes in an mdast tree. */
export const extractToc = (tree: Root): TocItem[] => {
  const items: TocItem[] = []
  visit(tree, node => {
    if (node.type !== 'heading') return
    const depth = node.depth
    const title = extractText({ type: 'root', children: node.children } as Root, 10_000)
    if (title) items.push({ depth, title, slug: slugify(title) })
  })
  return items
}

/** Parse markdown source into a CommonMark mdast tree (no GFM, no plugins). */
export const parseMarkdown = (source: string): Root => fromMarkdown(source)
