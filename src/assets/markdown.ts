import { visit } from 'unist-util-visit'

import { isRelativePath, processAsset } from './process'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast, Node } from 'mdast'
import type { VFile } from 'vfile'
import type { VeliteOutput } from '../output'
import type { AssetProcessingCache } from './cache'
import type { AssetStore } from './store'

export type CopyLinkedFilesOptions = Omit<VeliteOutput, 'data' | 'clean'> & {
  assets: AssetStore
  /** Optional engine-scoped cache passed to `processAsset` to dedupe work across owners. */
  assetCache?: AssetProcessingCache
}

const LINKED_PROPERTY_NAMES = ['href', 'src', 'poster']

/** rehype plugin to collect linked files and rewrite their urls. */
export const rehypeCopyLinkedFiles = (options: CopyLinkedFilesOptions) => async (tree: Hast, file: VFile) => {
  const links = new Map<string, Element[]>()
  visit(tree, 'element', node => {
    LINKED_PROPERTY_NAMES.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isRelativePath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, elements]) => {
      const publicUrl = await processAsset(url, file.path, options.name, options.base, options.assets, undefined, undefined, options.assetCache)
      if (publicUrl == null || publicUrl === url) return
      elements.forEach(node => {
        LINKED_PROPERTY_NAMES.forEach(name => {
          if (name in node.properties) {
            node.properties[name] = publicUrl
          }
        })
      })
    })
  )
}

/** remark plugin to collect linked files and rewrite their urls. */
export const remarkCopyLinkedFiles = (options: CopyLinkedFilesOptions) => async (tree: Mdast, file: VFile) => {
  const links = new Map<string, Node[]>()
  visit(tree, ['link', 'image', 'definition'], (node: any) => {
    if (isRelativePath(node.url)) {
      const nodes = links.get(node.url) ?? []
      nodes.push(node)
      links.set(node.url, nodes)
    }
  })
  visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], node => {
    const element = node as any
    element.attributes.forEach((attr: any) => {
      if (LINKED_PROPERTY_NAMES.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) {
        const nodes = links.get(attr.value) ?? []
        nodes.push(element)
        links.set(attr.value, nodes)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, nodes]) => {
      const publicUrl = await processAsset(url, file.path, options.name, options.base, options.assets, undefined, undefined, options.assetCache)
      if (publicUrl == null || publicUrl === url) return
      nodes.forEach((node: any) => {
        if (node.url === url) {
          node.url = publicUrl
          return
        }
        node.attributes.forEach((attr: any) => {
          LINKED_PROPERTY_NAMES.forEach(name => {
            if (attr.name === name && attr.value === url) {
              attr.value = publicUrl
            }
          })
        })
      })
    })
  )
}
