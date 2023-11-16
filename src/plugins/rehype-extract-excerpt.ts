import { visit } from 'unist-util-visit'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

const extractExcerpt: Plugin<[], Root> = () => (tree, file) => {
  const lines: string[] = []
  visit(tree, 'text', node => {
    lines.push(node.value)
  })
  // extract plain
  const plain = lines.join('').trim()
  // extract excerpt
  const excerpt = plain.slice(0, 100)
  Object.assign(file.data, { plain, excerpt })
}

export default extractExcerpt
