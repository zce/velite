import remarkGfm from 'remark-gfm'

import { fail } from '../../diagnostic'
import { remarkCopyLinkedFiles } from '../asset-links'
import { isMdxCommentExpression } from './mdx-comment'
import { captureNavigation } from './navigation'
import { createOwnedProcessor } from './processor'
import { removeChildrenWhere } from './tree-filter'

import type { Root as Hast } from 'hast'
import type { PluggableList } from 'unified'
import type { ProcessAsset } from '../asset-links'
import type { NavigationSnapshot } from './navigation'
import type { ContentProcessor } from './processor'
import type { MdxContentOptions, OwnedContent } from './types'

export interface MdxExecutionDeps {
  options: MdxContentOptions
  path: string
  cwd: string
  text: string
  processAsset?: ProcessAsset
}

export const createMdxExecution = ({ options, path, cwd, text, processAsset }: MdxExecutionDeps): OwnedContent => {
  let navigation: NavigationSnapshot = { items: [], limitations: [] }
  let closed = false
  const owned = createOwnedProcessor({
    path,
    cwd,
    text,
    async configure() {
      const remarkPlugins: PluggableList = []
      if (options.gfm) remarkPlugins.push(remarkGfm)
      if (options.removeComments)
        remarkPlugins.push(() => (tree: { type: string; children?: unknown[] }) => {
          // mdast: drop MDX expression nodes that are pure comments.
          removeChildrenWhere(tree, child => isMdxCommentExpression(child as { type?: string; value?: string }))
        })
      remarkPlugins.push(...(options.remarkPlugins ?? []))
      if (processAsset) remarkPlugins.push([remarkCopyLinkedFiles, processAsset])
      const { createProcessor } = await import('@mdx-js/mdx')
      return createProcessor({
        development: options.development,
        outputFormat: options.outputFormat,
        remarkPlugins,
        rehypePlugins: [
          ...(options.rehypePlugins ?? []),
          () => (tree: Hast) => {
            if (closed) fail('internal', 'MDX content is closed')
            navigation = captureNavigation(tree)
          }
        ],
        recmaPlugins: options.recmaPlugins
      }) as unknown as ContentProcessor
    }
  })
  return {
    ...owned,
    navigation: () => navigation,
    close() {
      closed = true
      owned.close()
      navigation = { items: [], limitations: [] }
    },
    async emit() {
      const code = await owned.emit()
      if (!options.minify) return code
      const { minify } = await import('terser')
      return (
        (await minify(code, { module: true, compress: true, keep_classnames: true, mangle: { keep_fnames: true }, parse: { bare_returns: true } })).code ?? code
      )
    }
  }
}
