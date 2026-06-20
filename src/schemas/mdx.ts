import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import * as z from 'zod'

import { remarkCopyLinkedFiles } from '../assets/markdown'
import { getContext } from './context'

import type { CompileOptions } from '@mdx-js/mdx'
import type { Root } from 'mdast'
import type { PluggableList } from 'unified'

/** MDX compiler options. */
export interface MdxOptions extends Omit<CompileOptions, 'outputFormat'> {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Copy linked files to the asset output and rewrite their urls. @default true */
  copyLinkedFiles?: boolean
  /** Output format to generate. @default 'function-body' */
  outputFormat?: CompileOptions['outputFormat']
  /** Minify the output code. @default true */
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

/** Compile the current content body as MDX. */
export const mdx = (options: MdxOptions = {}): z.ZodType<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, project, assetStore, assetCache } = getContext()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }

      const globalMdx = project.mdx
      const enableGfm = options.gfm ?? globalMdx?.gfm ?? true
      const enableMinify = options.minify ?? globalMdx?.minify ?? true
      const removeComments = options.removeComments ?? globalMdx?.removeComments ?? true
      const copyLinkedFiles = options.copyLinkedFiles ?? globalMdx?.copyLinkedFiles ?? true
      const outputFormat = options.outputFormat ?? globalMdx?.outputFormat ?? 'function-body'

      const remarkPlugins: PluggableList = []
      const rehypePlugins: PluggableList = []

      if (enableGfm) remarkPlugins.push(remarkGfm)
      if (removeComments) remarkPlugins.push(remarkRemoveComments)
      if (copyLinkedFiles) {
        remarkPlugins.push([remarkCopyLinkedFiles, { filename: project.output.name, baseUrl: project.output.base, assets: assetStore, cache: assetCache }])
      }
      if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
      if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
      if (globalMdx?.remarkPlugins != null) remarkPlugins.push(...globalMdx.remarkPlugins)
      if (globalMdx?.rehypePlugins != null) rehypePlugins.push(...globalMdx.rehypePlugins)

      const compilerOptions = { ...globalMdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

      const { compile } = await import('@mdx-js/mdx')

      try {
        const code = await compile({ value: body, path: file.path }, compilerOptions)
        if (!enableMinify) return String(code)
        const { minify } = await import('terser')
        const minified = await minify(String(code), {
          module: true,
          compress: true,
          keep_classnames: true,
          mangle: { keep_fnames: true },
          parse: { bare_returns: true }
        })
        return minified.code ?? String(code)
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
