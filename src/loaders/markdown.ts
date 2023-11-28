import { basename } from 'node:path'
import yaml from 'yaml'

import type { Loader } from '.'

// https://github.com/vfile/vfile-matter/blob/main/lib/index.js
const fmRegex = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/

export default {
  name: 'markdown',
  test: /\.(md|mdx)$/,
  load: async file => {
    const raw = file.toString().trim()
    const match = raw.match(fmRegex)
    const data = match == null ? {} : yaml.parse(match[1])

    // default data fields
    data.slug = data.slug ?? (file.stem === 'index' ? basename(file.dirname!) : file.stem)
    // data._file = file // output file for later use?

    const body = match == null ? raw : raw.slice(match[0].length).trim()
    // keep raw body with multiple keys (may be used) for later use
    data.metadata = body // for extract metadata (reading-time, word-count, etc.)
    data.raw = body // for extract body content
    data.body = body // for extract body content
    data.content = body // for extract content
    data.summary = body // for extract summary
    data.excerpt = body // for extract excerpt
    data.plain = body // for extract plain text
    data.html = body // for markdown render
    data.code = body // for mdx render

    return data
  }
} satisfies Loader
