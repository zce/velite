// Markdown / MDX plugins that copy locally-referenced asset files (images, link
// targets, etc.) to the assets output and rewrite their urls to the public urls.
//
// Pure unified plugins — they take a `processAsset(url) => Promise<string>`
// callback and do not touch the filesystem themselves. Resolving the asset
// (read bytes, compute hash, emit copy effect, return public url) is the
// caller's job, supplied via the callback. This keeps the plugins in
// runtime-neutral core (no `node:` / `sharp` / `tinyglobby` imports).
//
// Ported from the pre-refactor `src/assets.ts` `rehypeCopyLinkedFiles` /
// `remarkCopyLinkedFiles`, with the I/O extracted to the callback boundary.

import { visit } from 'unist-util-visit'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast } from 'mdast'
import type { Plugin } from 'unified'

/** A url is a candidate asset reference iff it is a relative path. */
const isRelativePath = (value: string): boolean => {
  if (value.startsWith('#') || value.startsWith('?') || value.startsWith('//')) return false
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return false
  if (/^(\/[^/\\]|[a-zA-Z]:\\)/.test(value)) return false
  return true
}

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
            if (name in node.properties) node.properties[name] = publicUrl
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
    type WithUrl = { url: string }
    type MdxAttr = { name: string; value: unknown }
    type MdxJsx = { attributes: MdxAttr[] }

    const links = new Map<string, unknown[]>()
    visit(tree, ['link', 'image', 'definition'], node => {
      const withUrl = node as unknown as WithUrl
      if (typeof withUrl.url === 'string' && isRelativePath(withUrl.url)) {
        const nodes = links.get(withUrl.url) ?? []
        nodes.push(node)
        links.set(withUrl.url, nodes)
      }
    })
    visit(tree, 'mdxJsxFlowElement' as never, node => {
      const jsx = node as unknown as MdxJsx
      for (const attr of jsx.attributes ?? []) {
        if (LINKED_PROPERTIES.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) {
          const nodes = links.get(attr.value) ?? []
          nodes.push(node)
          links.set(attr.value, nodes)
        }
      }
    })
    await Promise.all(
      Array.from(links.entries()).map(async ([url, nodes]) => {
        const publicUrl = await processAsset(url)
        if (publicUrl === url) return
        for (const node of nodes) {
          const withUrl = node as unknown as WithUrl
          if (withUrl.url === url) {
            withUrl.url = publicUrl
            continue
          }
          const jsx = node as unknown as MdxJsx
          for (const attr of jsx.attributes ?? []) {
            if (LINKED_PROPERTIES.includes(attr.name) && attr.value === url) attr.value = publicUrl
          }
        }
      })
    )
  }
