import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import mdxPlugin from '@mdx-js/esbuild'
import { build } from 'esbuild'
import { z } from 'zod'

import type { PluggableList } from 'unified'

export interface MdxOptions {
  gfm?: boolean
  removeComments?: boolean
  flattenImage?: boolean
  flattenListItem?: boolean
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

const uuid = () => Math.random().toString(36).slice(2, 8)

// https://github.com/kentcdodds/mdx-bundler/blob/v10.0.0/src/index.js
export const mdx = ({}: MdxOptions = {}) =>
  z.string().transform(async (value, ctx) => {
    const path = ctx.path[0] as string

    // const output = getOutputConfig()

    const entryFile = join(dirname(path), `_mdx_entry_point-${uuid()}.mdx`)
    try {
      await writeFile(entryFile, value)

      const bundled = await build({
        entryPoints: [entryFile],
        write: false,
        bundle: false,
        format: 'esm',
        plugins: [mdxPlugin({})]
      })

      return bundled.outputFiles[0].text
    } catch (err: any) {
      ctx.addIssue({ code: 'custom', message: err.message })
      return value
    } finally {
      await rm(entryFile, { force: true })
    }
  })
