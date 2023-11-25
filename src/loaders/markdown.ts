/**
 * @file markdown file loader
 */

import { basename } from 'node:path'
import yaml from 'yaml'

import { defineLoader } from '../types'

// import type { VFile } from 'vfile'

// const getFlattenedPath = (vfile: VFile) => {
//   return vfile.stem === 'index' ? basename(vfile.dirname!) : vfile.stem
// }

export default defineLoader({
  name: 'markdown',
  test: /\.(md|mdx)$/,
  load: async vfile => {
    const raw = vfile.toString()
    // https://github.com/vfile/vfile-matter/blob/main/lib/index.js
    const match = raw.match(/^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/)
    const data = match == null ? {} : yaml.parse(match[1])
    // // default data fields
    // data.slug = data.slug ?? getFlattenedPath(vfile)
    // data._file = vfile // output vfile for later use?
    const body = match == null ? raw : raw.slice(match[0].length).trim()
    // keep raw body with multiple keys (may be used) for later use
    data.metadata = body // for extract metadata (reading-time, word-count, etc.)
    data.body = body // for extract body content
    data.content = body // for extract content
    data.summary = body // for extract summary
    data.excerpt = body // for extract excerpt
    data.plain = body // for extract plain text
    data.html = body // for markdown render
    data.code = body // for mdx render
    data.raw = body // for extract body content
    return data
  }
})
