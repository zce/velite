// Markdown / MDX plugins that copy locally-referenced asset files (images, link
// targets, etc.) to the assets output and rewrite their urls to the public urls.
//
// Pure unified plugins — they take a `processAsset(url) => Promise<string>`
// callback and do not touch the filesystem themselves. Resolving the asset
// (read bytes, compute hash, emit copy effect, return public url) is the
// caller's job, supplied via the callback. This keeps the plugins in
// runtime-neutral core (no `node:` / `sharp` / `tinyglobby` imports).

import { visit } from 'unist-util-visit'

import { isRelativePath } from '../util/path'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast } from 'mdast'
import type { Plugin } from 'unified'

/** Resolve a relative url to its public url. Return the input unchanged to skip. */
export type ProcessAsset = (url: string) => Promise<string>

const LINKED_PROPERTIES: readonly string[] = ['href', 'src', 'poster']

/**
 * Rehype plugin: walks the hast tree, gathers `href` / `src` / `poster`
 * properties that point at relative paths, and rewrites them to the public url
 * returned by `processAsset`.
 */
export const rehypeCopyLinkedFiles: Plugin<[ProcessAsset], Hast> =
  processAsset =>
  async (tree: Hast): Promise<void> => {
    const links = new Map<string, Element[]>()
    visit(tree, 'element', node => {
      for (const name of LINKED_PROPERTIES) {
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
        const publicUrl = await processAsset(url)
        if (publicUrl === url) return
        for (const node of elements) {
          for (const name of LINKED_PROPERTIES) {
            if (node.properties[name] === url) node.properties[name] = publicUrl
          }
        }
      })
    )
  }

/**
 * Remark plugin: walks the mdast tree, gathers relative urls on `link` /
 * `image` / `definition` nodes and on mdx JSX attributes, then rewrites them
 * to the public url returned by `processAsset`.
 */
export const remarkCopyLinkedFiles: Plugin<[ProcessAsset], Mdast> =
  processAsset =>
  async (tree: Mdast): Promise<void> => {
    // mdast's link/image/definition nodes carry `url`; MDX JSX elements carry
    // `attributes`. visit's array tests only narrow to the generic Node, so
    // both shapes are read through one structural view.
    interface LinkedNode {
      url?: unknown
      attributes?: Array<{ name: string; value: unknown }>
    }
    const linked = (node: unknown): LinkedNode => node as LinkedNode

    const links = new Map<string, LinkedNode[]>()
    const add = (url: string, node: LinkedNode): void => {
      const nodes = links.get(url) ?? []
      nodes.push(node)
      links.set(url, nodes)
    }
    visit(tree, ['link', 'image', 'definition'], node => {
      const { url } = linked(node)
      if (typeof url === 'string' && isRelativePath(url)) add(url, linked(node))
    })
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'] as never, node => {
      for (const attr of linked(node).attributes ?? []) {
        if (LINKED_PROPERTIES.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) add(attr.value, linked(node))
      }
    })
    await Promise.all(
      Array.from(links.entries()).map(async ([url, nodes]) => {
        const publicUrl = await processAsset(url)
        if (publicUrl === url) return
        for (const node of nodes) {
          if (node.url === url) {
            node.url = publicUrl
            continue
          }
          for (const attr of node.attributes ?? []) {
            if (LINKED_PROPERTIES.includes(attr.name) && attr.value === url) attr.value = publicUrl
          }
        }
      })
    )
  }
