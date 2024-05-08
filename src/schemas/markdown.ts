import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { rehypeCopyLinkedFiles } from '../assets'
import { custom } from './zod'

import type { Root as Hast } from 'hast'
import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../types'

declare module 'hast' {
  interface Data {
    meta?: string
  }
}

const remarkRemoveComments = () => (tree: Mdast) => {
  visit(tree, 'html', (node, index, parent) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent!.children.splice(index!, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

const rehypeMetaString = () => (tree: Hast) => {
  visit(tree, 'element', node => {
    if (node.tagName === 'code' && node.data?.meta) {
      node.properties ??= {}
      node.properties.metastring = node.data.meta
    }
  })
}

export const markdown = (options: MarkdownOptions = {}) =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(async (value, { meta, addIssue }) => {
    value = value ?? meta.content
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'The content is empty' })
      return ''
    }

    const { markdown, output } = meta.config

    const enableGfm = options.gfm ?? markdown?.gfm ?? true
    const removeComments = options.removeComments ?? markdown?.removeComments ?? true
    const copyLinkedFiles = options.copyLinkedFiles ?? markdown?.copyLinkedFiles ?? true

    const remarkPlugins = [] as PluggableList
    const rehypePlugins = [] as PluggableList

    if (enableGfm) remarkPlugins.push(remarkGfm) // support gfm (autolink literals, footnotes, strikethrough, tables, tasklists).
    if (removeComments) remarkPlugins.push(remarkRemoveComments) // remove html comments
    if (copyLinkedFiles) rehypePlugins.push([rehypeCopyLinkedFiles, output]) // copy linked files to public path and replace their urls with public urls
    if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins) // apply remark plugins
    if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins) // apply rehype plugins
    if (markdown?.remarkPlugins != null) remarkPlugins.push(...markdown.remarkPlugins) // apply global remark plugins
    if (markdown?.rehypePlugins != null) rehypePlugins.push(...markdown.rehypePlugins) // apply global rehype plugins

    try {
      const html = await unified()
        .use(remarkParse) // parse markdown content to a syntax tree
        .use(remarkPlugins) // apply remark plugins
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeMetaString) // ensure `data.meta` is preserved in `properties.metastring` for rehype syntax highlighters
        .use(rehypeRaw) // turn markdown syntax tree to html syntax tree, with raw html support
        .use(rehypePlugins) // apply rehype plugins
        .use(rehypeStringify) // serialize html syntax tree
        .process({ value, path: meta.path })
      return html.toString()
    } catch (err: any) {
      addIssue({ fatal: true, code: 'custom', message: err.message })
      return null as never
    }
  })
