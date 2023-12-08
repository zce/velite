import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { rehypeCopyLinkedFiles } from '../assets'
import { custom } from './zod'

import type { Root as Mdast } from 'mdast'
import type { Plugin } from 'unified'
import type { MarkdownOptions } from '../types'

const remarkRemoveComments: Plugin<[], Mdast> = () => tree => {
  visit(tree, 'html', (node, index, parent) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent!.children.splice(index!, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export const markdown = (options: MarkdownOptions = {}) =>
  custom<string>().transform(async (value, { meta: { file, config }, addIssue }) => {
    if (value == null && file.data.content != null) {
      value = file.data.content
    }

    const { remarkPlugins = [], rehypePlugins = [] } = config.markdown ?? {}
    const { gfm = true, removeComments = true, copyLinkedFiles = true } = { ...config.markdown, ...options }

    if (gfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (copyLinkedFiles) rehypePlugins.push([rehypeCopyLinkedFiles, config.output.name, config.output.base]) // copy linked files to public path and replace their urls with public urls
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins

    try {
      const html = await unified()
        .use(remarkParse) // parse markdown content to a syntax tree
        .use(remarkPlugins) // apply remark plugins
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw) // turn markdown syntax tree to html syntax tree, with raw html support
        .use(rehypePlugins) // apply rehype plugins
        .use(rehypeStringify) // serialize html syntax tree
        .process({ value, path: file.path })
      return html.toString()
    } catch (err: any) {
      addIssue({ code: 'custom', message: err.message })
      return value
    }
  })
