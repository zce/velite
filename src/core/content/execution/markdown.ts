import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { fail } from '../../diagnostic'
import { rehypeCopyLinkedFiles } from '../asset-links'
import { captureNavigation } from './navigation'
import { createOwnedProcessor } from './processor'
import { removeChildrenWhere } from './tree-filter'

import type { Root as Hast } from 'hast'
import type { Root } from 'mdast'
import type { ProcessAsset } from '../asset-links'
import type { NavigationSnapshot } from './navigation'
import type { ContentProcessor } from './processor'
import type { ContentOptions, OwnedContent } from './types'

export interface MarkdownExecutionDeps {
  options: ContentOptions
  path: string
  cwd: string
  text: string
  processAsset?: ProcessAsset
}

export const createMarkdownExecution = ({ options, path, cwd, text, processAsset }: MarkdownExecutionDeps): OwnedContent => {
  let navigation: NavigationSnapshot = { items: [], limitations: [] }
  let closed = false
  const owned = createOwnedProcessor({
    path,
    cwd,
    text,
    configure() {
      const configured = unified().use(remarkParse)
      if (options.gfm) configured.use(remarkGfm)
      if (options.removeComments)
        configured.use(() => (tree: Root) => {
          // mdast: drop `html` nodes that are entirely one or more HTML comments.
          removeChildrenWhere(tree, child => {
            const c = child as { type?: string; value?: string }
            return c.type === 'html' && /^(?:\s*<!--(?:(?!-->)[\s\S])*-->)+\s*$/.test(c.value ?? '')
          })
        })
      configured.use(options.remarkPlugins ?? [])
      configured.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
      if (options.removeComments)
        configured.use(() => (tree: { type: string; children?: unknown[] }) => {
          // hast: drop comment nodes left after rehype-raw.
          removeChildrenWhere(tree, child => (child as { type?: string }).type === 'comment')
        })
      configured.use(options.rehypePlugins ?? []).use(rehypeStringify)
      if (processAsset) configured.use(rehypeCopyLinkedFiles, processAsset)
      configured.use(() => (tree: Hast) => {
        if (closed) fail('internal', 'Markdown content is closed')
        navigation = captureNavigation(tree)
      })
      return configured as unknown as ContentProcessor
    }
  })
  return {
    ...owned,
    navigation: () => navigation,
    close() {
      closed = true
      owned.close()
      navigation = { items: [], limitations: [] }
    }
  }
}
