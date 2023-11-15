import { visit } from 'unist-util-visit'

import { outputFile } from '../shared/static'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const urlRegex = /^(https?|mailto|ftp):\/\//

const extractLinkedFiles: Plugin<[], Root> = () => async (tree, file) => {
  const links = new Map<string, Element>()
  const replaces = new Map<string, string>()
  visit(tree, 'element', node => {
    if (typeof node.properties.href === 'string' && !urlRegex.test(node.properties.href)) {
      links.set(node.properties.href, node)
    }
    if (typeof node.properties.src === 'string' && !urlRegex.test(node.properties.src)) {
      links.set(node.properties.src, node)
    }
  })

  await Promise.all(
    [...links.entries()].map(async ([url, node]) => {
      const publicUrl = await outputFile(url, file.path)
      if (publicUrl == null || publicUrl === url) return
      if ('href' in node.properties) {
        node.properties.href = publicUrl
        replaces.set(url, publicUrl)
      }
      if ('src' in node.properties) {
        node.properties.src = publicUrl
        replaces.set(url, publicUrl)
      }
    })
  )

  file.data.replaces = replaces
}

export default extractLinkedFiles
