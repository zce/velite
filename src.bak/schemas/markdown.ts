import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

import { rehypeCopyLinkedFiles } from '../assets'
import { getConfig } from '../config'
import { getFile } from '../file'

import type { Root } from 'hast'
import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../types'

const remarkRemoveComments = () => (tree: Root) => {
  // https://github.com/alvinometric/remark-remove-comments/blob/main/transformer.js
  visit(tree, ['html', 'jsx'], (node: any, index, parent: any) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export const markdown = (options: MarkdownOptions = {}) =>
  z.custom().transform<string>(async (_, ctx) => {
    // // get cached file
    // const file = getFile(ctx.path[0] as string)
    // return file.markdown
  })
// z.string().transform(async (value, ctx) => {
//   const { markdown = {} } = getConfig()
//   const { remarkPlugins = [], rehypePlugins = [] } = markdown
//   const { gfm = true, removeComments = true, copyLinkedFiles = true } = { ...markdown, ...options }

//   if (gfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
//   if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
//   if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
//   if (copyLinkedFiles) rehypePlugins.push(rehypeCopyLinkedFiles) // copy linked files to public path and replace their urls with public urls
//   if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins

//   try {
//     const file = await unified()
//       .use(remarkParse) // parse markdown content to a syntax tree
//       .use(remarkPlugins) // apply remark plugins
//       .use(remarkRehype, { allowDangerousHtml: true })
//       .use(rehypeRaw) // turn markdown syntax tree to html syntax tree, with raw html support
//       .use(rehypePlugins) // apply rehype plugins
//       .use(rehypeStringify) // serialize html syntax tree
//       .process({ value, path: ctx.path[0] as string })
//     return file.toString()
//   } catch (err: any) {
//     ctx.addIssue({ code: 'custom', message: err.message })
//     return value
//   }
// })
