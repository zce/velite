import { excerpt } from 'hast-util-excerpt'
import { truncate } from 'hast-util-truncate'
import { visit } from 'unist-util-visit'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

interface ExtractExcerptOptions {
  separator?: string
  length?: number
}

const extractExcerpt: Plugin<[ExtractExcerptOptions], Root> =
  ({ separator, length }) =>
  (tree, file) => {
    if (separator != null) {
      tree = excerpt(tree, { comment: separator }) ?? tree
    } else if (length != null) {
      tree = truncate(tree, { size: length, ellipsis: '…' })
    }

    const lines: string[] = []
    visit(tree, 'text', node => {
      lines.push(node.value)
    })

    Object.assign(file.data, { plain: lines.join('').trim() })

    return tree
  }

export default extractExcerpt
