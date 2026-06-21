// Markdown rendering: source -> HTML, with optional toc / excerpt / reference
// discovery.
//
// Runtime-agnostic: `unified` + remark/rehype plugins (all pure, bundled
// devDeps). No node: builtins, no I/O. Asset copying (rehypeCopyLinkedFiles)
// is intentionally NOT wired here — it lands in M5.
//
// Built from the z-labs `src/core/content/markdown.ts` reference, enriched with
// the current velite's `gfm` / `removeComments` / `remarkPlugins` / `rehypePlugins`
// options and `rehype-raw` for raw-HTML pass-through fidelity.

import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { extractText, extractToc, findReferences, parseMarkdown } from './reference'

import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'
import type { ContentReference, TocItem } from './reference'

/** Markdown rendering options. */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Include a table of contents from headings. */
  toc?: boolean
  /** Max plain-text excerpt length (0 / undefined = omit). */
  excerpt?: number
  /** Collect local image/link references from the body. */
  references?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
}

/** Result of rendering markdown source. */
export interface MarkdownResult {
  html: string
  toc?: TocItem[]
  excerpt?: string
  references?: ContentReference[]
}

/** Remove html comments (`<!-- ... -->`) from the mdast tree. */
const remarkRemoveComments = () => (tree: Mdast) => {
  visit(tree, 'html', (node, index, parent) => {
    if (parent == null || index == null) return
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

/** Convert markdown source to HTML with optional toc, excerpt and reference discovery. */
export const processMarkdown = async (source: string, options: MarkdownOptions = {}): Promise<MarkdownResult> => {
  const enableGfm = options.gfm ?? true
  const removeComments = options.removeComments ?? true

  const tree = parseMarkdown(source)

  const remarkPlugins: PluggableList = []
  if (enableGfm) remarkPlugins.push(remarkGfm)
  if (removeComments) remarkPlugins.push(remarkRemoveComments)
  if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)

  const rehypePlugins: PluggableList = []
  if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)

  const file = await unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypePlugins)
    .use(rehypeStringify)
    .process(source)

  const result: MarkdownResult = { html: String(file) }
  if (options.toc) result.toc = extractToc(tree)
  if (options.excerpt && options.excerpt > 0) result.excerpt = extractText(tree, options.excerpt)
  if (options.references) result.references = findReferences(tree)
  return result
}

export type { ContentReference, TocItem } from './reference'
export { extractToc, extractText, findReferences, parseMarkdown } from './reference'
