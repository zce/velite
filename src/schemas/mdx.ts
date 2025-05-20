import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

import { remarkCopyLinkedFiles } from '../assets'
import { custom } from './zod'

import type { Root } from 'mdast'
import type { PluggableList } from 'unified'
import type { MdxOptions } from '../types'

const remarkRemoveComments = () => (tree: Root) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent: any) => {
    if (node.value.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export const mdx = (options: MdxOptions = {}) =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(async (value, { meta, addIssue }) => {
    value = value ?? meta.content
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return ''
    }

    const { mdx, output } = meta.config

    const enableGfm = options.gfm ?? mdx?.gfm ?? true
    const enableMinify = options.minify ?? mdx?.minify ?? true
    const removeComments = options.removeComments ?? mdx?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? mdx?.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? mdx?.outputFormat ?? 'function-body'

    const remarkPlugins = [] as PluggableList
    const rehypePlugins = [] as PluggableList

    if (enableGfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, output]) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins
    if (mdx?.remarkPlugins != null) remarkPlugins.push(...mdx.remarkPlugins) // apply global remark plugins
    if (mdx?.rehypePlugins != null) rehypePlugins.push(...mdx.rehypePlugins) // apply global rehype plugins

    const compilerOptions = { ...mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

    const { compile } = await import('@mdx-js/mdx')

    try {
      const code = await compile({ value, path: meta.path }, compilerOptions)

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
    } catch (err: any) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null as never
    }
  })
