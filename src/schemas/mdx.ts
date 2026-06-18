import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { custom } from 'zod'

import { assetStoreKey, remarkCopyLinkedFiles } from '../core/assets'
import { internalContext } from '../core/context'

import type { CompileOptions } from '@mdx-js/mdx'
import type { Root } from 'mdast'
import type { PluggableList } from 'unified'

/**
 * MDX compiler options
 */
export interface MdxOptions extends Omit<CompileOptions, 'outputFormat'> {
  /**
   * Enable GitHub Flavored Markdown (GFM).
   * @default true
   */
  gfm?: boolean
  /**
   * Remove html comments.
   * @default true
   */
  removeComments?: boolean
  /**
   * Copy linked files to public path and replace their urls with public urls.
   * @default true
   */
  copyLinkedFiles?: boolean
  /**
   * Output format to generate.
   * @default 'function-body'
   */
  outputFormat?: CompileOptions['outputFormat']
  /**
   * Minify the output code.
   * @default true
   */
  minify?: boolean
}

const remarkRemoveComments = () => (tree: Root) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent) => {
    if (parent == null || index == null) return
    if ((node as { value?: string }).value?.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

export const mdx = (options: MdxOptions = {}) =>
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, config, store } = internalContext()
      const assets = store.get(assetStoreKey)
      value = value ?? file.content
      if (value == null || value.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }

      const { mdx, output } = config

      const enableGfm = options.gfm ?? mdx?.gfm ?? true
      const enableMinify = options.minify ?? mdx?.minify ?? true
      const removeComments = options.removeComments ?? mdx?.removeComments ?? true
      const copyLinkedFiles = options.copyLinkedFiles ?? mdx?.copyLinkedFiles ?? true
      const outputFormat = options.outputFormat ?? mdx?.outputFormat ?? 'function-body'

      const remarkPlugins = [] as PluggableList
      const rehypePlugins = [] as PluggableList

      if (enableGfm) remarkPlugins.push(remarkGfm)
      if (removeComments) remarkPlugins.push(remarkRemoveComments)
      if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, { ...output, assets }])
      if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
      if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
      if (mdx?.remarkPlugins != null) remarkPlugins.push(...mdx.remarkPlugins)
      if (mdx?.rehypePlugins != null) rehypePlugins.push(...mdx.rehypePlugins)

      const compilerOptions = { ...mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

      const { compile } = await import('@mdx-js/mdx')

      try {
        const code = await compile({ value, path: file.path }, compilerOptions)

        if (!enableMinify) return code.toString()

        const { minify } = await import('terser')
        const minified = await minify(code.toString(), {
          module: true,
          compress: true,
          keep_classnames: true,
          mangle: { keep_fnames: true },
          parse: { bare_returns: true }
        })
        return minified.code ?? code.toString()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.addIssue({ fatal: true, code: 'custom', message })
        return null as never
      }
    })
