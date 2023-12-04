import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import { visit } from 'unist-util-visit'
import { z } from 'zod'

// import { remarkCopyLinkedFiles } from '../assets'
import { getConfig } from '../config'
import { MdxOptions } from '../types'

import type { Root } from 'mdast'

const remarkRemoveComments = () => (tree: Root) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent: any) => {
    if (node.value.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index] // https://unifiedjs.com/learn/recipe/remove-node/
    }
  })
}

export const mdx = (options: MdxOptions = {}) =>
  z.custom().transform(async (value, ctx) => {
    return ''
  })
