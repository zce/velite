import { compile } from '@mdx-js/mdx'
import { minify } from 'terser'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'

import { remarkCopyLinkedFiles } from '../assets'
import { custom } from './zod'

import type { Root } from 'mdast'
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

    const gfm = options.gfm ?? config.mdx?.gfm ?? true
    const removeComments = options.removeComments ?? config.mdx?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? config.mdx?.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? config.mdx?.outputFormat ?? 'function-body'

    const remarkPlugins = config.mdx?.remarkPlugins ?? []
    const rehypePlugins = config.mdx?.rehypePlugins ?? []

    if (gfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) remarkPlugins.push([remarkCopyLinkedFiles, config.output]) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins

    const compilerOptions = { ...mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

    try {
      const code = await compile({ value, path: file.path }, compilerOptions)
      const minified = await minify(code.toString(), {
        compress: true,
        keep_classnames: true,
        mangle: {
          keep_fnames: true,
        },
        module: true,
        parse: {
          bare_returns: true,
        },
      })
      return minified.code || ''
    } catch (err: any) {
      addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
