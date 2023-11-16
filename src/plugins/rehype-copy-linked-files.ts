import { visit } from 'unist-util-visit'

import { outputFile } from '../shared/static'

import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

const linkedPropertyNames = ['href', 'src', 'poster']

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const absoluteUrlRegex = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const absolutePathRegex = /^\/[^/\\]/

const isRelativeUrl = (url: string) => !url.startsWith('#') && !absoluteUrlRegex.test(url) && !absolutePathRegex.test(url)

const copyLinkedFiles: Plugin<[], Root> = () => async (tree, file) => {
  const links = new Map<string, Element[]>()
  // const replaces = new Map<string, string>()

  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isRelativeUrl(value)) {
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
            // replaces.set(url, publicUrl)
          }
        })
      })
    })
  )

  // file.data.replaces = replaces
}

export default copyLinkedFiles
