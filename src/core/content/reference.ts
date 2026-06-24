// Markdown reference helpers: AST parsing, reference discovery, plain-text
// extraction and table-of-contents extraction.
//
// Runtime-agnostic: depends only on `unified` / `remark-parse` / `remark-gfm`
// / `unist-util-visit` (all pure, bundled devDeps). No node: builtins, no I/O.
//
// `parseMarkdown` returns a GFM-aware mdast tree. It is the shared parse for
// toc/excerpt/references AND for `s.markdown()` (which runs remark-rehype
// directly on the tree, skipping the parse phase).

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
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

/** Parse markdown source into a GFM-aware mdast tree (no plugins, no html). */
export const parseMarkdown = (source: string): Root => unified().use(remarkParse).use(remarkGfm).parse(source) as Root
