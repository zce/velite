import { visit } from 'unist-util-visit'

import { isValidatedStaticPath, outputFile } from '../static'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const linkedPropertyNames = ['href', 'src', 'poster']

const copyLinkedFiles: Plugin<[], Root> = () => async (tree, file) => {
  const links = new Map<string, Element[]>()

  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isValidatedStaticPath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })

  await Promise.all(
    [...links.entries()].map(async ([url, elements]) => {
      const publicUrl = await outputFile(url, file.path)
      if (publicUrl == null || publicUrl === url) return
      elements.forEach(node => {
        linkedPropertyNames.forEach(name => {
          if (name in node.properties) {
            node.properties[name] = publicUrl
          }
        })
      })
    })
  )
}

export default copyLinkedFiles
