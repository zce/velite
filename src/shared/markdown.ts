import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import z from 'zod'

import rehypeCopyLinkedFiles from '../plugins/rehype-copy-linked-files'
import rehypeExtractExcerpt from '../plugins/rehype-extract-excerpt'
import remarkFlattenImage from '../plugins/remark-flatten-image'
import remarkFlattenListItem from '../plugins/remark-flatten-listitem'
import remarkRemoveComments from '../plugins/remark-remove-comments'

import type { PluggableList } from 'unified'

interface MarkdownBody {
  // raw: string
  plain: string
  excerpt: string
  html: string
}

type BuiltinPlugins = Array<'remove-comments' | 'flatten-image' | 'flatten-listitem'>

interface MarkdownOptions {
  builtinPlugins?: BuiltinPlugins
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

const getBuiltInPlugins = (plugins?: BuiltinPlugins) => {
  if (plugins == null) return []
  return plugins.map(p => {
    switch (p) {
      case 'remove-comments':
        return remarkRemoveComments
      case 'flatten-image':
        return remarkFlattenImage
      case 'flatten-listitem':
        return remarkFlattenListItem
    }
  })
}

export const markdown = (options: MarkdownOptions = {}) =>
  z.string().transform(async (value, ctx): Promise<MarkdownBody> => {
    try {
      const file = await unified()
        .use(remarkParse) // Parse markdown content to a syntax tree
        .use(remarkGfm) // Support GFM (autolink literals, footnotes, strikethrough, tables, tasklists).
        .use(getBuiltInPlugins(options.builtinPlugins)) // apply built-in plugins
        .use(options.remarkPlugins ?? []) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
        .use(remarkRehype, { allowDangerousHtml: true }) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
        .use(rehypeRaw) // Parse the html content to a syntax tree
        .use(options.rehypePlugins ?? []) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
        .use(rehypeCopyLinkedFiles) // Copy linked files to public path and replace their URLs with public URLs
        .use(rehypeExtractExcerpt) // Extract excerpt and plain into file.data
        .use(rehypeStringify) // Serialize HTML syntax tree
        .process({ value, path: ctx.path[0] as string })

      // const replaces = file.data.replaces as Map<string, string>

      // // replace links
      // if (replaces != null) {
      //   for (const [url, publicUrl] of replaces.entries()) {
      //     value = value.replaceAll(url, publicUrl)
      //   }
      // }

      return {
        // raw: value,
        plain: file.data.plain as string,
        excerpt: file.data.excerpt as string,
        html: file.toString()
      }
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return { plain: '', excerpt: '', html: '' }
    }
  })
