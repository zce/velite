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
  custom<string>().transform<string>(async (value, { meta: { file, config }, addIssue }) => {
    if (value == null && file.data.content != null) {
      value = file.data.content
    }

    const enableGfm = options.gfm ?? config.mdx?.gfm ?? true
    const enableMinify = options.minify ?? config.mdx?.minify ?? true
    const removeComments = options.removeComments ?? config.mdx?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? config.mdx?.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? config.mdx?.outputFormat ?? 'function-body'

    const remarkPlugins = [] as PluggableList
    const rehypePlugins = [] as PluggableList

    if (enableGfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, config.output]) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins
    if (config.mdx?.remarkPlugins != null) remarkPlugins.push(...config.mdx.remarkPlugins) // apply global remark plugins
    if (config.mdx?.rehypePlugins != null) rehypePlugins.push(...config.mdx.rehypePlugins) // apply global rehype plugins

    const compilerOptions = { ...config.mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

    const { compile } = await import('@mdx-js/mdx')
    const { minify } = await import('terser')

    try {
      const code = await compile({ value, path: file.path }, compilerOptions)

      if (!enableMinify) return code.toString()

      const minified = await minify(code.toString(), {
        module: true,
        compress: true,
        keep_classnames: true,
        mangle: { keep_fnames: true },
        parse: { bare_returns: true }
      })
      return minified.code ?? code.toString()
    } catch (err: any) {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    }
  })
