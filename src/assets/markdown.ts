import { visit } from 'unist-util-visit'

import { isRelativePath, processAsset } from './process'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast, Node } from 'mdast'
import type { VFile } from 'vfile'
import type { AssetProcessingCache } from './cache'
import type { AssetStore } from './store'

/** Options shared by the remark/rehype linked-file copy plugins. */
export interface CopyLinkedFilesOptions {
  /** Asset filename template. */
  filename: string
  /** Public base url. */
  baseUrl: string
  /** Session asset store. */
  assets: AssetStore
  /** Engine-scoped asset processing cache. */
  cache?: AssetProcessingCache
}

const LINKED_PROPERTY_NAMES = ['href', 'src', 'poster']

const rewrite = async (url: string, file: VFile, options: CopyLinkedFilesOptions): Promise<string | undefined> => {
  const result = await processAsset({
    input: url,
    from: String(file.path),
    filename: options.filename,
    baseUrl: options.baseUrl,
    assets: options.assets,
    cache: options.cache
  })
  return result.publicUrl
}

/** rehype plugin to collect linked files and rewrite their urls. */
export const rehypeCopyLinkedFiles =
  (options: CopyLinkedFilesOptions) =>
  async (tree: Hast, file: VFile): Promise<void> => {
    const links = new Map<string, Element[]>()
    visit(tree, 'element', node => {
      for (const name of LINKED_PROPERTY_NAMES) {
        const value = node.properties[name]
        if (typeof value === 'string' && isRelativePath(value)) {
          const elements = links.get(value) ?? []
          elements.push(node)
          links.set(value, elements)
        }
      }
    })
    await Promise.all(
      Array.from(links.entries()).map(async ([url, elements]) => {
        const publicUrl = await rewrite(url, file, options)
        if (publicUrl == null || publicUrl === url) return
        for (const node of elements) {
          for (const name of LINKED_PROPERTY_NAMES) {
            if (name in node.properties) node.properties[name] = publicUrl
          }
        }
      })
    )
  }

/** remark plugin to collect linked files and rewrite their urls. */
export const remarkCopyLinkedFiles =
  (options: CopyLinkedFilesOptions) =>
  async (tree: Mdast, file: VFile): Promise<void> => {
    const links = new Map<string, Node[]>()
    visit(tree, ['link', 'image', 'definition'], (node: Node) => {
      const url = (node as { url?: string }).url
      if (url != null && isRelativePath(url)) {
        const nodes = links.get(url) ?? []
        nodes.push(node)
        links.set(url, nodes)
      }
    })
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], node => {
      const element = node as { attributes?: Array<{ name?: string; value?: unknown }> }
      element.attributes?.forEach(attr => {
        if (attr.name != null && LINKED_PROPERTY_NAMES.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) {
          const nodes = links.get(attr.value) ?? []
          nodes.push(element as unknown as Node)
          links.set(attr.value, nodes)
        }
      })
    })
    await Promise.all(
      Array.from(links.entries()).map(async ([url, nodes]) => {
        const publicUrl = await rewrite(url, file, options)
        if (publicUrl == null || publicUrl === url) return
        for (const node of nodes) {
          const n = node as { url?: string; attributes?: Array<{ name?: string; value?: unknown }> }
          if (n.url === url) {
            n.url = publicUrl
            continue
          }
          n.attributes?.forEach(attr => {
            if (attr.name != null && LINKED_PROPERTY_NAMES.includes(attr.name) && attr.value === url) attr.value = publicUrl
          })
        }
      })
    )
  }
