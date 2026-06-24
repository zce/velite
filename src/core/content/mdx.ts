// MDX rendering: source -> compiled JavaScript module string.
//
// MDX-specific: `@mdx-js/mdx` and `terser` are runtime dependencies (external,
// not bundled) loaded via dynamic import so they are only pulled in when MDX is
// actually used. Both are allowed in core: neither is in the runtime-neutral
// guard's FORBIDDEN list (node: / sharp / chokidar / tinyglobby / jiti), and
// dynamic imports are invisible to that guard's static-import scan anyway.

import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

import { remarkCopyLinkedFiles } from './asset-links'

import type { CompileOptions } from '@mdx-js/mdx'
import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'
import type { ProcessAsset } from './asset-links'

/** MDX compiler options. */
export interface MdxOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove `/* ... *​/` comments from mdx expressions. @default true */
  removeComments?: boolean
  /** Minify the output code via terser. @default true */
  minify?: boolean
  /** Output format to generate. @default 'function-body' */
  outputFormat?: CompileOptions['outputFormat']
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
  /** Enable development-friendly output. @default false */
  development?: boolean
  /**
   * Copy locally-referenced asset files into the assets output. The schema
   * layer reads this global default and decides whether to wire
   * `processAsset` for each mdx invocation. @default true
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

/** Options for {@link processMdx}. */
export interface ProcessMdxOptions extends MdxOptions {
  /** Source path hint passed to the compiler (vfile path). */
  path?: string
  /**
   * Pre-parsed MDX mdast tree. When provided, the MDX processor skips the
   * parse step and goes directly to run + compile. Callers that parse once
   * and need both toc/excerpt and compiled code can pass the tree here.
   */
  mdast?: Mdast
}

/** Remove `/* ... *​/` comments from mdx flow expressions. */
const remarkRemoveComments = () => (tree: Mdast) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent) => {
    if (parent == null || index == null) return
    if ((node as { value?: string }).value?.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

/**
 * Compile MDX source to a JavaScript module string.
 *
 * Uses `createProcessor` from `@mdx-js/mdx` for a clean three-phase pipeline:
 *
 *   1. `processor.parse(source)`  → mdast  (skipped when `options.mdast` is provided)
 *   2. `processor.run(mdast)`     → estree
 *   3. `processor.stringify(estree)` → JS string
 *
 * Callers that only need a CommonMark mdast tree for toc/excerpt/reference
 * extraction should use `parseMarkdown()` directly.
 */
export const processMdx = async (source: string, options: ProcessMdxOptions = {}): Promise<string> => {
  const remarkPlugins: PluggableList = []
  if (options.gfm ?? true) remarkPlugins.push(remarkGfm)
  if (options.removeComments ?? true) remarkPlugins.push(remarkRemoveComments)
  if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
  if (options.processAsset != null) remarkPlugins.push([remarkCopyLinkedFiles, options.processAsset])

  const rehypePlugins: PluggableList = []
  if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)

  const { createProcessor } = await import('@mdx-js/mdx')
  const processor = createProcessor({
    development: options.development ?? false,
    outputFormat: options.outputFormat ?? 'function-body',
    remarkPlugins,
    rehypePlugins
  })

  const mdast = options.mdast ?? processor.parse(source)
  // @ts-expect-error — @mdx-js/mdx type declares HeadTree as Program but the
  // processor actually accepts mdast Root at runtime (parse → run → stringify).
  const estree = await processor.run(mdast)
  let code = String(processor.stringify(estree))

  if (options.minify ?? true) {
    const { minify } = await import('terser')
    code =
      (
        await minify(code, {
          module: true,
          compress: true,
          keep_classnames: true,
          mangle: { keep_fnames: true },
          parse: { bare_returns: true }
        })
      ).code ?? code
  }

  return code
}
