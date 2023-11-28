import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

import { isValidatedStaticPath, outputFile } from '../assets'
import { getConfig } from '../config'

import type { CompileOptions } from '@mdx-js/mdx'
import type { Node, Root } from 'mdast'
import type { Plugin } from 'unified'

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
}

const remarkRemoveComments: Plugin<[], Root> = () => tree => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent: any) => {
    if (node.value.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

const remarkCopyLinkedFiles: Plugin<[], Root> = () => async (tree, file) => {
  const links = new Map<string, Node[]>()

  visit(tree, ['link', 'image', 'definition'], (node: any) => {
    if (isValidatedStaticPath(node.url)) {
      const nodes = links.get(node.url) || []
      nodes.push(node)
      links.set(node.url, nodes)
    }
  })

  visit(tree, 'mdxJsxFlowElement', node => {
    node.attributes.forEach((attr: any) => {
      if (['href', 'src', 'poster'].includes(attr.name) && typeof attr.value === 'string' && isValidatedStaticPath(attr.value)) {
        const nodes = links.get(attr.value) || []
        nodes.push(node)
        links.set(attr.value, nodes)
      }
    })
  })

  await Promise.all(
    [...links.entries()].map(async ([url, nodes]) => {
      const publicUrl = await outputFile(url, file.path)
      if (publicUrl == null || publicUrl === url) return
      nodes.forEach((node: any) => {
        if ('url' in node && node.url === url) {
          node.url = publicUrl
          return
        }
        if ('href' in node && node.href === url) {
          node.href = publicUrl
          return
        }

        node.attributes.forEach((attr: any) => {
          if (attr.name === 'src' && attr.value === url) {
            attr.value = publicUrl
          }
          if (attr.name === 'href' && attr.value === url) {
            attr.value = publicUrl
          }
          if (attr.name === 'poster' && attr.value === url) {
            attr.value = publicUrl
          }
        })
      })
    })
  )
}

export const mdx = (options: MdxOptions = {}) =>
  z.string().transform(async (value, ctx) => {
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
