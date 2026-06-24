// Markdown rendering: source -> HTML.
//
// Runtime-agnostic: `unified` + remark/rehype plugins (all pure, bundled
// devDeps). No node: builtins, no I/O. Asset copying (rehypeCopyLinkedFiles)
// is intentionally NOT wired here — it lands in M5.

import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { rehypeCopyLinkedFiles } from './asset-links'

import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'
import type { ProcessAsset } from './asset-links'

/**
 * A Markdown source: either a raw string, or a pre-parsed mdast tree.
 *
 * When a tree is passed, the remark/rehype pipeline runs directly on it
 * (skipping the parse phase). Use `parseMarkdown()` from `reference.ts` to
 * obtain a GFM-aware mdast tree from a string.
 */
export type MarkdownSource = string | Mdast

/** Markdown rendering options. */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
  /**
   * Copy locally-referenced asset files into the assets output. The schema
   * layer reads this global default and decides whether to wire
   * `processAsset` for each markdown invocation. @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Copy local image/link references encountered in the body to the assets
   * output and replace their urls with the public urls returned by
   * `processAsset`. The schema layer wires this through `context().asset(...)`
   * and `collectEffect(...)`; pure-core / tests can leave it `undefined`.
   */
  processAsset?: ProcessAsset
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

/**
 * Convert markdown to HTML through the remark/rehype pipeline.
 *
 * When `source` is a string, the full pipeline runs (parse + transform +
 * stringify). When it is an already-parsed mdast tree, the parse phase is
 * skipped and the pipeline runs directly on a structured clone of the tree
 * (so the caller's tree is never mutated by remark/rehype plugins).
 *
 * SSOT: callers that already have an mdast tree (e.g. from the lazily-cached
 * `file.mdast`) should pass it directly to avoid a redundant parse.
 */
export const processMarkdown = async (source: MarkdownSource, options: MarkdownOptions = {}): Promise<string> => {
  const remarkPlugins: PluggableList = []
  if (options.gfm ?? true) remarkPlugins.push(remarkGfm)
  if (options.removeComments ?? true) remarkPlugins.push(remarkRemoveComments)
  if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)

  const rehypePlugins: PluggableList = []
  if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
  if (options.processAsset != null) rehypePlugins.push([rehypeCopyLinkedFiles, options.processAsset])

  if (typeof source !== 'string') {
    // Tree mode: skip parse, run remark/rehype transforms directly.
    // The tree is cloned so plugins that mutate don't affect the caller's cache.
    const pipeline = unified().use(remarkPlugins).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypePlugins).use(rehypeStringify)
    return String(pipeline.stringify(await pipeline.run(structuredClone(source))))
  }

  // String mode: full parse + transform + stringify.
  return String(
    await unified()
      .use(remarkParse)
      .use(remarkPlugins)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypePlugins)
      .use(rehypeStringify)
      .process(source)
  )
}
