import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'
import remarkGfm from 'remark-gfm'
import z from 'zod'

import remarkFlattenImage from '../plugins/remark-flatten-image'
import remarkFlattenListItem from '../plugins/remark-flatten-listitem'
import remarkRemoveComments from '../plugins/remark-remove-comments'

import type { PluggableList } from 'unified'

interface MdxBody {
  plain: string
  excerpt: string
  code: string
}

interface MdxOptions {
  gfm?: boolean
  removeComments?: boolean
  flattenImage?: boolean
  flattenListItem?: boolean
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

// https://github.com/kentcdodds/mdx-bundler/blob/v10.0.0/src/index.js
export const mdx = ({ gfm = true, removeComments = true, flattenImage = true, flattenListItem = true, remarkPlugins = [], rehypePlugins = [] }: MdxOptions = {}) => {
  if (gfm) remarkPlugins.push(remarkGfm)
  if (removeComments) remarkPlugins.push(remarkRemoveComments)
  if (flattenImage) remarkPlugins.push(remarkFlattenImage)
  if (flattenListItem) remarkPlugins.push(remarkFlattenListItem)

  return z.string().transform(async (value, ctx): Promise<MdxBody> => {
    const path = ctx.path[0] as string

    // const output = getOutputConfig()

    const entryFile = join(dirname(path), `_mdx_entry_point-${Math.random()}.mdx`)
    try {
      await writeFile(entryFile, value)

      const bundled = await build({
        entryPoints: [entryFile],
        write: false,
        bundle: true,
        format: 'esm',
        plugins: [
          mdxPlugin({
            remarkPlugins,
            rehypePlugins
          })
        ]
      })

      return {
        plain: value as string,
        excerpt: value as string,
        code: bundled.outputFiles[0].text
      }
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return {} as MdxBody
    } finally {
      await rm(entryFile, { force: true })
    }
  })
}
