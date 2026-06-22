// MDX rendering: source -> compiled JavaScript module string.
//
// `@mdx-js/mdx` and `terser` are runtime dependencies (external, not bundled)
// loaded via dynamic import so they are only pulled in when MDX is actually
// used. Both are allowed in core: neither is in the runtime-neutral guard's
// FORBIDDEN list (node: / sharp / chokidar / tinyglobby / jiti), and dynamic
// imports are invisible to that guard's static-import scan anyway.
//
// Asset copying (remarkCopyLinkedFiles) is intentionally NOT wired here — M5.
//
// Built from the z-labs `src/core/content/mdx.ts` reference, enriched with the
// current velite's `gfm` / `removeComments` / `minify` / `outputFormat` /
// plugin passthrough options.

import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

import { remarkCopyLinkedFiles } from './asset-links'
import { findReferences, parseMarkdown } from './reference'

import type { CompileOptions } from '@mdx-js/mdx'
import type { Root } from 'mdast'
import type { PluggableList } from 'unified'
import type { ProcessAsset } from './asset-links'
import type { ContentReference } from './reference'

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

/** Result of compiling MDX source. */
export interface MdxResult {
  /** Compiled MDX module source (JavaScript). */
  code: string
  references?: ContentReference[]
}

/** Options for {@link processMdx}. */
export interface ProcessMdxOptions extends MdxOptions {
  /** Collect local image/link references from the body. */
  references?: boolean
  /** Source path hint passed to the compiler (vfile path). */
  path?: string
}

/** Remove `/* ... *​/` comments from mdx flow expressions. */
const remarkRemoveComments = () => (tree: Root) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent) => {
    if (parent == null || index == null) return
    if ((node as { value?: string }).value?.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

/** Compile MDX source to a JavaScript module string. */
export const processMdx = async (source: string, options: ProcessMdxOptions = {}): Promise<MdxResult> => {
  const enableGfm = options.gfm ?? true
  const removeComments = options.removeComments ?? true
  const enableMinify = options.minify ?? true
  const outputFormat = options.outputFormat ?? 'function-body'
  const development = options.development ?? false

  const remarkPlugins: PluggableList = []
  if (enableGfm) remarkPlugins.push(remarkGfm)
  if (removeComments) remarkPlugins.push(remarkRemoveComments)
  if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
  if (options.processAsset != null) remarkPlugins.push([remarkCopyLinkedFiles, options.processAsset])

  const rehypePlugins: PluggableList = []
  if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)

  const compilerOptions: CompileOptions = {
    development,
    outputFormat,
    remarkPlugins,
    rehypePlugins
  }

  const { compile } = await import('@mdx-js/mdx')
  const compiled = await compile({ value: source, ...(options.path != null ? { path: options.path } : {}) }, compilerOptions)
  let code = String(compiled)

  if (enableMinify) {
    const { minify } = await import('terser')
    const minified = await minify(code, {
      module: true,
      compress: true,
      keep_classnames: true,
      mangle: { keep_fnames: true },
      parse: { bare_returns: true }
    })
    code = minified.code ?? code
  }

  const result: MdxResult = { code }
  if (options.references) result.references = findReferences(parseMarkdown(source))
  return result
}
