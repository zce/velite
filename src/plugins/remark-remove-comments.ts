import { SKIP, visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

const removeComments: Plugin<[], Root> = () => tree => {
  // https://github.com/alvinometric/remark-remove-comments/blob/main/transformer.js
  visit(tree, ['html', 'jsx'], (node: any, index, parent: any) => {
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return [SKIP, index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export default removeComments
