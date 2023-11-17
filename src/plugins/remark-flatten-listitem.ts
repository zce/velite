import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

const flattenListItem: Plugin<[], Root> = () => tree => {
  // https://gitlab.com/staltz/mdast-flatten-listitem-paragraphs/-/blob/master/index.js
  visit(tree, 'listItem', node => {
    if (node.children.length === 1 && node.children[0].type === 'paragraph') {
      node.children = node.children[0].children as any
    }
  })
}

export default flattenListItem
