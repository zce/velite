import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

import { remarkCopyLinkedFiles } from '../assets'
import { getConfig } from '../config'
import { getFile } from '../file'

import type { Root } from 'mdast'
import type { MdxOptions } from '../config'

const remarkRemoveComments = () => (tree: Root) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent: any) => {
    if (node.value.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export const mdx = (options: MdxOptions = {}) =>
  z.custom<string>().transform(async (value, ctx) => {
    if (value == null) {
      value = getFile(ctx.path[0] as string).data.content!
    }

    const { mdx = {} } = getConfig()
    const gfm = options.gfm ?? mdx.gfm ?? true
    const removeComments = options.removeComments ?? mdx.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? mdx.copyLinkedFiles ?? true
    const outputFormat = options.outputFormat ?? mdx.outputFormat ?? 'function-body'

    const remarkPlugins = mdx.remarkPlugins ?? []
    const rehypePlugins = mdx.rehypePlugins ?? []

    if (gfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) remarkPlugins.push(remarkCopyLinkedFiles) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins

    const compilerOptions = { ...mdx, ...options, outputFormat, remarkPlugins, rehypePlugins }

    try {
      const file = await compile({ value, path: ctx.path[0] as string }, compilerOptions)
      // TODO: minify output
      return file
        .toString()
        .replace(/^"use strict";/, '')
        .replace(/\s+/g, ' ')
        .trim()
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
