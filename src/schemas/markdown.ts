import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { custom } from 'zod'

import { assetStoreKey, createAssetStore, rehypeCopyLinkedFiles } from '../assets'
import { context } from '../runtime/context'

import type { Root as Hast } from 'hast'
import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'

/**
 * Markdown options
 */
export interface MarkdownOptions {
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
   * Remark plugins.
   */
  remarkPlugins?: PluggableList
  /**
   * Rehype plugins.
   */
  rehypePlugins?: PluggableList
}

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
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, config, store } = context()
      const assets = store.getOrCreate(assetStoreKey, createAssetStore)
      value = value ?? file.content
      if (value == null || value.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }

      const { markdown, output } = config

      const enableGfm = options.gfm ?? markdown?.gfm ?? true
      const removeComments = options.removeComments ?? markdown?.removeComments ?? true
      const copyLinkedFiles = options.copyLinkedFiles ?? markdown?.copyLinkedFiles ?? true

      const remarkPlugins = [] as PluggableList
      const rehypePlugins = [] as PluggableList

      if (enableGfm) remarkPlugins.push(remarkGfm) // gfm: autolinks, footnotes, strikethrough, tables, tasklists
      if (removeComments) remarkPlugins.push(remarkRemoveComments) // strip html comments
      if (copyLinkedFiles) rehypePlugins.push([rehypeCopyLinkedFiles, { ...output, assets }]) // copy linked files
      if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
      if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
      if (markdown?.remarkPlugins != null) remarkPlugins.push(...markdown.remarkPlugins)
      if (markdown?.rehypePlugins != null) rehypePlugins.push(...markdown.rehypePlugins)

      try {
        const html = await unified()
          .use(remarkParse)
          .use(remarkPlugins)
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeMetaString) // preserve `data.meta` in `properties.metastring` for highlighters
          .use(rehypeRaw)
          .use(rehypePlugins)
          .use(rehypeStringify)
          .process({ value, path: file.path })
        return html.toString()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        ctx.addIssue({ fatal: true, code: 'custom', message })
        return null as never
      }
    })
