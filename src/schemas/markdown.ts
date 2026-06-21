import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import * as z from 'zod'

import { rehypeCopyLinkedFiles } from '../assets/markdown'
import { context } from './context'

import type { Root as Hast } from 'hast'
import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'

/** Markdown rendering options. */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Copy linked files to the asset output and rewrite their urls. @default true */
  copyLinkedFiles?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
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
      return ['skip', index]
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

/** Render the current content body to HTML. */
export const markdown = (options: MarkdownOptions = {}): z.ZodType<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, project, assetStore, assetCache } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }

      const globalMarkdown = project.markdown
      const enableGfm = options.gfm ?? globalMarkdown?.gfm ?? true
      const removeComments = options.removeComments ?? globalMarkdown?.removeComments ?? true
      const copyLinkedFiles = options.copyLinkedFiles ?? globalMarkdown?.copyLinkedFiles ?? true

      const remarkPlugins: PluggableList = []
      const rehypePlugins: PluggableList = []

      if (enableGfm) remarkPlugins.push(remarkGfm)
      if (removeComments) remarkPlugins.push(remarkRemoveComments)
      if (copyLinkedFiles) {
        rehypePlugins.push([rehypeCopyLinkedFiles, { filename: project.output.name, baseUrl: project.output.base, assets: assetStore, cache: assetCache }])
      }
      if (options.remarkPlugins != null) remarkPlugins.push(...options.remarkPlugins)
      if (options.rehypePlugins != null) rehypePlugins.push(...options.rehypePlugins)
      if (globalMarkdown?.remarkPlugins != null) remarkPlugins.push(...globalMarkdown.remarkPlugins)
      if (globalMarkdown?.rehypePlugins != null) rehypePlugins.push(...globalMarkdown.rehypePlugins)

      try {
        const html = await unified()
          .use(remarkParse)
          .use(remarkPlugins)
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeMetaString)
          .use(rehypeRaw)
          .use(rehypePlugins)
          .use(rehypeStringify)
          .process({ value: body, path: file.path })
        return String(html)
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
