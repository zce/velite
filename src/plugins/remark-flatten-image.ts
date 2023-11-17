import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

const flattenImage: Plugin<[], Root> = () => tree => {
  // https://gitlab.com/staltz/mdast-flatten-image-paragraphs/-/blob/master/index.js
  visit(tree, 'paragraph', node => {
    if (node.children.length === 1 && node.children[0].type === 'image') {
      Object.assign(node, node.children[0], { children: undefined })
    }
  })
}

export default flattenImage
