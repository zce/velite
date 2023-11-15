import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import z from 'zod'

import extractExcerpt from '../plugins/extract-excerpt'
import extractLinkedFiles from '../plugins/extract-linked-files'
import flattenImage from '../plugins/flatten-image'
import flattenListItem from '../plugins/flatten-listitem'
import removeComments from '../plugins/remove-comments'

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
        return removeComments
      case 'flatten-image':
        return flattenImage
      case 'flatten-listitem':
        return flattenListItem
    }
  })
}

export const markdown = (options: MarkdownOptions = {}) => {
  return z.string().transform(async (value, ctx): Promise<MarkdownBody> => {
    const file = await unified()
      .use(remarkParse) // Parse markdown content to a syntax tree
      .use(remarkGfm) // Support GFM (autolink literals, footnotes, strikethrough, tables, tasklists).
      .use(getBuiltInPlugins(options.builtinPlugins)) // apply built-in plugins
      .use(options.remarkPlugins ?? []) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
      .use(remarkRehype, { allowDangerousHtml: true }) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
      .use(rehypeRaw) // Parse the html content to a syntax tree
      .use(options.rehypePlugins ?? []) // Turn markdown syntax tree to HTML syntax tree, ignoring embedded HTML
      .use(extractLinkedFiles) // Extract linked files and replace their URLs with public URLs
      .use(extractExcerpt) // Extract excerpt and plain
      .use(rehypeStringify) // Serialize HTML syntax tree
      .process({ value, path: ctx.path[0] as string })

    const replaces = file.data.replaces as Map<string, string>

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
  })
}
