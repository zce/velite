import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

import { getConfig } from '../config'
import { isValidatedStaticPath, outputFile } from '../static'

import type { MarkdownOptions } from '../types'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const remarkRemoveComments: Plugin<[], Root> = () => tree => {
  // https://github.com/alvinometric/remark-remove-comments/blob/main/transformer.js
  visit(tree, ['html', 'jsx'], (node: any, index, parent: any) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

const rehypeCopyLinkedFiles: Plugin<[], Root> = () => async (tree, file) => {
  const links = new Map<string, Element[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']

  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isValidatedStaticPath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })

  await Promise.all(
    [...links.entries()].map(async ([url, elements]) => {
      const publicUrl = await outputFile(url, file.path)
      if (publicUrl == null || publicUrl === url) return
      elements.forEach(node => {
        linkedPropertyNames.forEach(name => {
          if (name in node.properties) {
            node.properties[name] = publicUrl
          }
        })
      })
    })
  )
}

export const markdown = (options: MarkdownOptions = {}) =>
  z.string().transform(async (value, ctx) => {
    const { markdown } = getConfig()
    const { gfm, removeComments, copyLinkedFiles } = { ...markdown, ...options }
    const remarkPlugins = markdown.remarkPlugins.concat(options.remarkPlugins ?? [])
    const rehypePlugins = markdown.rehypePlugins.concat(options.rehypePlugins ?? [])
    if (gfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) rehypePlugins.push(rehypeCopyLinkedFiles) // copy linked files to public path and replace their urls with public urls
    const file = unified()
      .use(remarkParse) // parse markdown content to a syntax tree
      .use(remarkPlugins) // apply remark plugins
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw) // turn markdown syntax tree to html syntax tree, with raw html support
      .use(rehypePlugins) // apply rehype plugins
      .use(rehypeStringify) // serialize html syntax tree
    try {
      const html = await file.process({ value, path: ctx.path[0] as string })
      return html.toString()
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
